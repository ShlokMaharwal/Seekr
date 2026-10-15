/**
 * Redis Query Cache
 *
 * Caches search results with a 60-second TTL.
 * Cache key includes: query, ranker, page, limit (all params that affect results).
 *
 * Why 60s?
 *   The index is updated incrementally as new pages are crawled. A 60-second
 *   window is short enough that users see fresh results within a minute of new
 *   content being indexed, while still providing meaningful throughput gains
 *   for repeated hot queries (which are common for popular search terms).
 */
const CACHE_TTL_SECONDS = 60;
const KEY_PREFIX = 'cache:search:';
export class QueryCache {
    redis;
    constructor(redis) {
        this.redis = redis;
    }
    key(q, ranker, page, limit) {
        // Simple deterministic key that won't exceed Redis key size limits
        const safe = q.slice(0, 200).replace(/[^a-z0-9 ]/gi, '_');
        return `${KEY_PREFIX}${ranker}:${page}:${limit}:${safe}`;
    }
    async get(q, ranker, page, limit) {
        const raw = await this.redis.get(this.key(q, ranker, page, limit));
        if (!raw)
            return null;
        try {
            return JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
    async set(q, ranker, page, limit, response) {
        await this.redis.set(this.key(q, ranker, page, limit), JSON.stringify(response), 'EX', CACHE_TTL_SECONDS);
    }
    async invalidateAll() {
        const keys = await this.redis.keys(`${KEY_PREFIX}*`);
        if (keys.length > 0) {
            await this.redis.del(...keys);
        }
    }
}
//# sourceMappingURL=cache.js.map