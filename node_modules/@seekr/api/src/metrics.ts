/**
 * Metrics tracker
 *
 * Tracks per-query latency in Redis using a sliding window, computes p50/p99,
 * and maintains a sorted set of top searched queries.
 *
 * Latency samples are stored in a Redis ZSET keyed by timestamp so we can
 * efficiently query the last N minutes without scanning all data.
 *
 * Data structures:
 *   - "metrics:latency"     ZSET: score=ts, member=latencyMs (as string)
 *   - "metrics:queries"     ZSET: score=count, member=query string
 *   - "metrics:crawlRate"   ZSET: maintained by the crawler frontier
 *   - "metrics:cache:hits"  STRING: Redis cache hit counter
 *   - "metrics:cache:total" STRING: total requests counter
 */

import { type Redis } from 'ioredis';

const K_LATENCY = 'metrics:latency';
const K_QUERIES = 'metrics:queries';
const K_CACHE_HITS = 'metrics:cache:hits';
const K_CACHE_TOTAL = 'metrics:cache:total';
const K_CRAWL_RATE = 'stats:crawlRate';

const WINDOW_MS = 60 * 60 * 1000; // 1-hour sliding window for latency
const TOP_QUERIES_MAX = 100;

export class MetricsTracker {
  constructor(private readonly redis: Redis) {}

  /** Record a query's latency in milliseconds. */
  async recordLatency(ms: number): Promise<void> {
    const now = Date.now();
    await this.redis.zadd(K_LATENCY, now, `${now}:${ms}`);
    // Prune entries older than the window
    await this.redis.zremrangebyscore(K_LATENCY, '-inf', now - WINDOW_MS);
  }

  /** Increment the hit counter for a query string. */
  async recordQuery(q: string): Promise<void> {
    await this.redis.zincrby(K_QUERIES, 1, q);
    // Keep only top N queries
    const size = await this.redis.zcard(K_QUERIES);
    if (size > TOP_QUERIES_MAX) {
      await this.redis.zremrangebyrank(K_QUERIES, 0, size - TOP_QUERIES_MAX - 1);
    }
  }

  async recordCacheHit(): Promise<void> {
    await this.redis.incr(K_CACHE_HITS);
    await this.redis.incr(K_CACHE_TOTAL);
  }

  async recordCacheMiss(): Promise<void> {
    await this.redis.incr(K_CACHE_TOTAL);
  }

  /** Returns latency p50 and p99 bucketed by minute over the last hour. */
  async getLatencyBuckets(): Promise<Array<{ ts: string; p50: number; p99: number }>> {
    const now = Date.now();
    const members = await this.redis.zrangebyscore(
      K_LATENCY, now - WINDOW_MS, '+inf',
    );

    // Group by minute bucket
    const buckets = new Map<number, number[]>();
    for (const m of members) {
      const [tsStr, msStr] = m.split(':');
      const ts = parseInt(tsStr ?? '0', 10);
      const ms = parseInt(msStr ?? '0', 10);
      const minute = Math.floor(ts / 60_000) * 60_000;
      let arr = buckets.get(minute);
      if (!arr) { arr = []; buckets.set(minute, arr); }
      arr.push(ms);
    }

    const result: Array<{ ts: string; p50: number; p99: number }> = [];
    for (const [minute, samples] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
      samples.sort((a, b) => a - b);
      result.push({
        ts: new Date(minute).toISOString(),
        p50: percentile(samples, 50),
        p99: percentile(samples, 99),
      });
    }
    return result;
  }

  /** Returns crawl rate bucketed by minute over the last hour. */
  async getCrawlRate(): Promise<Array<{ ts: string; count: number }>> {
    const now = Date.now();
    const entries = await this.redis.zrangebyscore(
      K_CRAWL_RATE, now - WINDOW_MS, '+inf', 'WITHSCORES',
    );

    const result: Array<{ ts: string; count: number }> = [];
    for (let i = 0; i < entries.length - 1; i += 2) {
      const ts = parseInt(entries[i + 1] ?? '0', 10);
      // The member is the timestamp string, scores are used for ordering;
      // The actual count is stored as the ZSET score via ZINCRBY
      // Re-fetch the score which represents the page count for that bucket
      const score = parseFloat(entries[i + 1] ?? '0');
      const memberScore = await this.redis.zscore(K_CRAWL_RATE, entries[i] ?? '');
      result.push({
        ts: new Date(ts).toISOString(),
        count: Math.round(parseFloat(memberScore ?? '0')),
      });
    }
    return result;
  }

  /** Returns top queries sorted by count descending. */
  async getTopQueries(limit = 20): Promise<Array<{ q: string; count: number }>> {
    const entries = await this.redis.zrevrangebyscore(
      K_QUERIES, '+inf', '-inf', 'WITHSCORES', 'LIMIT', '0', String(limit),
    );
    const result: Array<{ q: string; count: number }> = [];
    for (let i = 0; i < entries.length - 1; i += 2) {
      result.push({ q: entries[i] as string, count: parseInt(entries[i + 1] ?? '0', 10) });
    }
    return result;
  }

  async getCacheHitRate(): Promise<number> {
    const hits = parseInt((await this.redis.get(K_CACHE_HITS)) ?? '0', 10);
    const total = parseInt((await this.redis.get(K_CACHE_TOTAL)) ?? '0', 10);
    return total > 0 ? hits / total : 0;
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(idx, sorted.length - 1)] ?? 0;
}
