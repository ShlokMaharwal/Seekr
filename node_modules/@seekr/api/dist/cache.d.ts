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
import { type Redis } from 'ioredis';
import type { SearchResponse } from '@seekr/core';
export declare class QueryCache {
    private readonly redis;
    constructor(redis: Redis);
    private key;
    get(q: string, ranker: string, page: number, limit: number): Promise<SearchResponse | null>;
    set(q: string, ranker: string, page: number, limit: number, response: SearchResponse): Promise<void>;
    invalidateAll(): Promise<void>;
}
//# sourceMappingURL=cache.d.ts.map