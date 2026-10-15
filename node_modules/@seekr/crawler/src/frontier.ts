/**
 * URL Frontier – Redis-backed per-domain URL queues
 *
 * Design:
 *   - Each domain gets its own Redis list: "frontier:<domain>"
 *   - A global sorted set "frontier:domains" tracks domains with pending URLs,
 *     scored by their next-allowed-crawl timestamp (Unix ms). This enforces
 *     per-domain politeness delays without a centralized scheduler.
 *   - A Redis set "frontier:seen" holds all enqueued/crawled URL hashes to
 *     prevent duplicates before fetching.
 *
 * Politeness:
 *   When a domain is dequeued for processing, its next-allowed timestamp is
 *   updated to `now + delayMs`. The worker waits until that time before
 *   fetching the next URL from the same domain.
 *
 * Concurrency safety:
 *   All read-modify-write operations (peek domain, pop URL, update timestamp)
 *   are wrapped in a Lua script executed atomically by Redis, so multiple
 *   worker processes cannot crawl the same URL twice.
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

function urlHash(url: string): string {
  return crypto.createHash('sha1').update(url).digest('hex');
}

// ---------------------------------------------------------------------------
// Lua script: atomically pop the next due URL from any ready domain.
//
// KEYS[1] = K_DOMAINS (ZSET)
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
-- Check if more URLs remain; if so, reschedule; otherwise remove
local remaining = redis.call('LLEN', qkey)
if remaining > 0 then
  redis.call('ZADD', KEYS[1], next_ts, domain)
else
  redis.call('ZREM', KEYS[1], domain)
end
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
   * Atomically dequeue the next URL from any domain whose politeness delay
   * has elapsed. Returns null if no URL is currently available.
   */
  async dequeue(): Promise<{ url: string; domain: string } | null> {
    const now = Date.now();
    const nextTs = now + this.delayMs;

    const result = await this.redis.eval(
      this.script,
      1,
      K_DOMAINS,
      String(now),
      String(nextTs),
    ) as [string, string] | null;

    if (result == null) return null;
    await this.redis.decr(K_STATS_QUEUE);
    return { domain: result[0] as string, url: result[1] as string };
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
    await pipeline.exec();
    logger.info('Frontier reset');
  }
}
