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
export declare class MetricsTracker {
    private readonly redis;
    constructor(redis: Redis);
    /** Record a query's latency in milliseconds. */
    recordLatency(ms: number): Promise<void>;
    /** Increment the hit counter for a query string. */
    recordQuery(q: string): Promise<void>;
    recordCacheHit(): Promise<void>;
    recordCacheMiss(): Promise<void>;
    /** Returns latency p50 and p99 bucketed by minute over the last hour. */
    getLatencyBuckets(): Promise<Array<{
        ts: string;
        p50: number;
        p99: number;
    }>>;
    /** Returns crawl rate bucketed by minute over the last hour. */
    getCrawlRate(): Promise<Array<{
        ts: string;
        count: number;
    }>>;
    /** Returns top queries sorted by count descending. */
    getTopQueries(limit?: number): Promise<Array<{
        q: string;
        count: number;
    }>>;
    getCacheHitRate(): Promise<number>;
}
//# sourceMappingURL=metrics.d.ts.map