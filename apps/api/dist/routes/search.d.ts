/**
 * Search route: GET /search
 *
 * Query params (validated with zod):
 *   q       - raw query string (required)
 *   page    - page number, default 1
 *   limit   - results per page, default 10 (max 50)
 *   ranker  - 'bm25' | 'tfidf', default 'bm25'
 *
 * Response (SearchResponse):
 *   { total, tookMs, didYouMean?, results: [{ id, title, url, snippet, score }] }
 *
 * Cache:
 *   Results are cached in Redis for 60 seconds. Cache key = ranker:page:limit:q.
 *   Cache hit rate is tracked in metrics.
 */
import { Router } from 'express';
import type { IndexManager } from '../index-manager.js';
import type { QueryCache } from '../cache.js';
import type { MetricsTracker } from '../metrics.js';
export declare function searchRouter(indexManager: IndexManager, cache: QueryCache, metrics: MetricsTracker): Router;
//# sourceMappingURL=search.d.ts.map