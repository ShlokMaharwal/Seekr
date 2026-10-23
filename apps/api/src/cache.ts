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
import { createHash } from 'node:crypto';
import type { SearchResponse } from '@seekr/core';

const CACHE_TTL_SECONDS = 60;
const KEY_PREFIX = 'cache:search:';

export class QueryCache {
  constructor(private readonly redis: Redis) {}

  private key(q: string, ranker: string, page: number, limit: number): string {
    // Simple deterministic key that won't exceed Redis key size limits
    const safe = createHash('sha256').update(q).digest('hex');
    return `${KEY_PREFIX}${ranker}:${page}:${limit}:${safe}`;
  }

  async get(
    q: string,
    ranker: string,
    page: number,
    limit: number,
  ): Promise<SearchResponse | null> {
    const raw = await this.redis.get(this.key(q, ranker, page, limit));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SearchResponse;
    } catch {
      return null;
    }
  }

  async set(
    q: string,
    ranker: string,
    page: number,
    limit: number,
    response: SearchResponse,
  ): Promise<void> {
    await this.redis.set(
      this.key(q, ranker, page, limit),
      JSON.stringify(response),
      'EX',
      CACHE_TTL_SECONDS,
    );
  }

  async invalidateAll(): Promise<void> {
    const keys = await this.redis.keys(`${KEY_PREFIX}*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
