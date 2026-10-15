/**
 * Express application factory
 *
 * Wires together:
 *   - CORS (allow http://localhost:5173 for the frontend)
 *   - JSON body parser
 *   - Pino HTTP request logging
 *   - All route handlers
 *   - Centralized error handler
 */
import express from 'express';
import type { IndexManager } from './index-manager.js';
import type { QueryCache } from './cache.js';
import type { MetricsTracker } from './metrics.js';
import type { DocumentStore } from './store.js';
import { type Redis } from 'ioredis';
export declare function createApp(deps: {
    indexManager: IndexManager;
    cache: QueryCache;
    metrics: MetricsTracker;
    store: DocumentStore;
    redis: Redis;
}): express.Application;
//# sourceMappingURL=app.d.ts.map