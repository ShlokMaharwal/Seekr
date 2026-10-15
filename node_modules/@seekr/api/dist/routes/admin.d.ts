/**
 * Admin routes
 *
 * GET  /admin/stats          - corpus & crawl statistics
 * GET  /admin/crawl/feed     - recent crawl events (capped list)
 * GET  /admin/metrics        - latency p50/p99, crawl rate, top queries
 * POST /admin/crawl/start    - start a new crawl
 * POST /admin/crawl/pause    - pause the running crawl
 * POST /admin/crawl/stop     - stop and reset the crawl
 */
import { Router } from 'express';
import { type Redis } from 'ioredis';
import type { IndexManager } from '../index-manager.js';
import type { MetricsTracker } from '../metrics.js';
import type { DocumentStore } from '../store.js';
export declare function adminRouter(indexManager: IndexManager, metrics: MetricsTracker, store: DocumentStore, redis: Redis): Router;
//# sourceMappingURL=admin.d.ts.map