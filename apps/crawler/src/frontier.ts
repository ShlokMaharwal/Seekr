/**
 * URL Frontier – Redis-backed per-domain URL queues with reliable-queue processing
 *
 * Design:
 *   - Each domain gets its own Redis list: "frontier:queue:<domain>"
 *   - A global sorted set "frontier:domains" tracks domains with pending URLs,
 *     scored by their next-allowed-crawl timestamp (Unix ms).
 *   - A Redis set "frontier:seen" holds all enqueued/crawled URL hashes to
 *     prevent duplicates before fetching.
 *   - A per-worker sorted set "frontier:processing:<workerId>" holds currently
 *     active URLs with their checkout timestamp. If a worker dies, a reaper
 *     re-enqueues abandoned URLs.
 *
 * Concurrency safety:
 *   All read-modify-write operations (peek domain, pop URL, update delay timestamp,
 *   and record in worker processing set) are wrapped in a Lua script executed atomically
 *   by Redis. This guarantees two workers can never crawl the same URL.
 */

import crypto from 'crypto';
import { type Redis } from 'ioredis';
import { logger } from './logger.js';

// Key names
const K_DOMAINS = 'frontier:domains';          // ZSET: domain → next-allowed ts
const K_SEEN = 'frontier:seen';                // SET:  url hashes
const K_STATS_QUEUE = 'stats:queueSize';      // STRING: total pending URLs
const K_STATS_DUPS = 'stats:duplicates';      // STRING: duplicate count
const K_STATS_FAIL = 'stats:failures';        // STRING: failure count
const K_CRAWL_RATE = 'stats:crawlRate';       // ZSET: ts → count (sorted by ts)
const K_FEED = 'feed:events';                 // LIST: recent crawl events (capped)

const FEED_MAX_LEN = 200;

function domainKey(domain: string): string {
  return `frontier:queue:${domain}`;
}

export function processingKey(workerId: string): string {
  return `frontier:processing:${workerId}`;
}

function urlHash(url: string): string {
  return crypto.createHash('sha1').update(url).digest('hex');
}

// ---------------------------------------------------------------------------
// Lua script: atomically pop the next due URL and move it to the worker's
// processing set with the checkout timestamp.
//
// KEYS[1] = K_DOMAINS (ZSET)
// KEYS[2] = processingKey (ZSET: payload -> timestamp)
// ARGV[1] = current timestamp (ms)
// ARGV[2] = new delay timestamp (next allowed = now + delayMs)
//
// Returns: [domain, url] or nil
// ---------------------------------------------------------------------------
const POP_SCRIPT = `
local now = tonumber(ARGV[1])
local next_ts = tonumber(ARGV[2])

-- Get the domain with the lowest score (earliest next-allowed time)
local items = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', now, 'LIMIT', 0, 1)
if #items == 0 then return nil end
local domain = items[1]
local qkey = 'frontier:queue:' .. domain

-- Pop the next URL from this domain's queue
local url = redis.call('LPOP', qkey)
if url == nil or url == false then
  -- Domain queue is empty; remove from domains set
  redis.call('ZREM', KEYS[1], domain)
  return nil
end

-- Check if more URLs remain; if so, reschedule domain; otherwise remove
local remaining = redis.call('LLEN', qkey)
if remaining > 0 then
  redis.call('ZADD', KEYS[1], next_ts, domain)
else
  redis.call('ZREM', KEYS[1], domain)
end

-- Record in reliable worker processing set with current timestamp
local payload = cjson.encode({url = url, domain = domain})
redis.call('ZADD', KEYS[2], now, payload)

return {domain, url}
`;

export interface FrontierConfig {
  redis: Redis;
  delayMs?: number;
}

export class UrlFrontier {
  private readonly redis: Redis;
  private readonly delayMs: number;
  private readonly script: string = POP_SCRIPT;

  constructor({ redis, delayMs = 500 }: FrontierConfig) {
    this.redis = redis;
    this.delayMs = delayMs;
  }

  /**
   * Enqueue a URL if it hasn't been seen before.
   * Returns true if the URL was added, false if it was a duplicate.
   */
  async enqueue(url: string, domain: string): Promise<boolean> {
    const hash = urlHash(url);

    // SADD returns 1 if the element was new, 0 if already present
    const added = await this.redis.sadd(K_SEEN, hash);
    if (added === 0) {
      await this.redis.incr(K_STATS_DUPS);
      return false;
    }

    await this.redis.rpush(domainKey(domain), url);
    // Add domain to domains ZSET if not present (score = 0 = immediately eligible)
    await this.redis.zadd(K_DOMAINS, 'NX', 0, domain);
    await this.redis.incr(K_STATS_QUEUE);
    return true;
  }

  /**
   * Atomically dequeue the next URL from any eligible domain and add it
   * to the worker's processing set. Returns null if no URL is currently available.
   */
  async dequeue(workerId = 'default'): Promise<{ url: string; domain: string } | null> {
    const now = Date.now();
    const nextTs = now + this.delayMs;

    const result = (await this.redis.eval(
      this.script,
      2,
      K_DOMAINS,
      processingKey(workerId),
      String(now),
      String(nextTs),
    )) as [string, string] | null;

    if (result == null) return null;
    await this.redis.decr(K_STATS_QUEUE);
    return { domain: result[0] as string, url: result[1] as string };
  }

  /**
   * Remove a URL from the worker's processing set when processing completes.
   */
  async complete(workerId: string, url: string, domain: string): Promise<void> {
    const payload = JSON.stringify({ url, domain });
    await this.redis.zrem(processingKey(workerId), payload);
  }

  /**
   * Scan for abandoned processing entries across workers whose checkout timestamp
   * is older than staleTimeoutMs, and re-enqueue them for processing.
   */
  async reapStale(staleTimeoutMs = 60_000): Promise<number> {
    const now = Date.now();
    const cutoff = now - staleTimeoutMs;
    let reapedCount = 0;

    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        'frontier:processing:*',
        'COUNT',
        50,
      );
      cursor = nextCursor;

      for (const pKey of keys) {
        const staleMembers = await this.redis.zrangebyscore(pKey, '-inf', cutoff);
        for (const raw of staleMembers) {
          try {
            const parsed = JSON.parse(raw) as { url: string; domain: string };
            // Re-enqueue the URL at the front of its domain queue
            await this.redis.lpush(domainKey(parsed.domain), parsed.url);
            await this.redis.zadd(K_DOMAINS, 'NX', 0, parsed.domain);
            await this.redis.incr(K_STATS_QUEUE);
            await this.redis.zrem(pKey, raw);
            reapedCount++;
            logger.warn({ url: parsed.url, domain: parsed.domain, workerKey: pKey }, 'Reaped stale URL from crashed/stuck worker');
          } catch {
            await this.redis.zrem(pKey, raw);
          }
        }
      }
    } while (cursor !== '0');

    return reapedCount;
  }

  /** Total number of URLs waiting in all domain queues. */
  async queueSize(): Promise<number> {
    const val = await this.redis.get(K_STATS_QUEUE);
    return Math.max(0, parseInt(val ?? '0', 10));
  }

  /** Record a crawl event into the capped feed list. */
  async recordEvent(
    url: string,
    status: 'success' | 'failed' | 'duplicate' | 'skipped',
  ): Promise<void> {
    const event = JSON.stringify({ url, status, ts: new Date().toISOString() });
    await this.redis.lpush(K_FEED, event);
    await this.redis.ltrim(K_FEED, 0, FEED_MAX_LEN - 1);

    if (status === 'failed') {
      await this.redis.incr(K_STATS_FAIL);
    }

    // Record crawl rate: bucket by minute
    const minute = Math.floor(Date.now() / 60000) * 60000;
    await this.redis.zadd(K_CRAWL_RATE, 'NX', minute, String(minute));
    await this.redis.zincrby(K_CRAWL_RATE, 1, String(minute));
    // Keep only last 60 minutes
    await this.redis.zremrangebyscore(K_CRAWL_RATE, '-inf', String(minute - 60 * 60 * 1000));
  }

  /** Mark a URL as seen without enqueueing (for content-duplicate suppression). */
  async markSeen(url: string): Promise<void> {
    await this.redis.sadd(K_SEEN, urlHash(url));
  }

  /** Check if a URL has already been seen. */
  async hasSeen(url: string): Promise<boolean> {
    return (await this.redis.sismember(K_SEEN, urlHash(url))) === 1;
  }

  /** Reset the entire frontier (used by /admin/crawl/stop). */
  async reset(): Promise<void> {
    const domains = await this.redis.zrange(K_DOMAINS, 0, -1);
    const pipeline = this.redis.pipeline();
    for (const d of domains) {
      pipeline.del(domainKey(d));
    }
    pipeline.del(K_DOMAINS);
    pipeline.del(K_SEEN);
    pipeline.set(K_STATS_QUEUE, '0');

    // Also remove any worker processing queues
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        'frontier:processing:*',
        'COUNT',
        100,
      );
      cursor = nextCursor;
      for (const k of keys) {
        pipeline.del(k);
      }
    } while (cursor !== '0');

    await pipeline.exec();
    logger.info('Frontier reset');
  }
}
