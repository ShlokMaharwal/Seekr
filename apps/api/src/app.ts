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

import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import pinoHttpPkg from 'pino-http';
const pinoHttp = (pinoHttpPkg as any).default || pinoHttpPkg;
import { logger } from './logger.js';
import { searchRouter } from './routes/search.js';
import { autocompleteRouter } from './routes/autocomplete.js';
import { docRouter } from './routes/doc.js';
import { adminRouter } from './routes/admin.js';
import type { IndexManager } from './index-manager.js';
import type { QueryCache } from './cache.js';
import type { MetricsTracker } from './metrics.js';
import type { DocumentStore } from './store.js';
import { type Redis } from 'ioredis';

export function createApp(deps: {
  indexManager: IndexManager;
  cache: QueryCache;
  metrics: MetricsTracker;
  store: DocumentStore;
  redis: Redis;
}): express.Application {
  const app = express();

  // CORS – allow the Seekr frontend origin
  app.use(cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:8080',
    ],
    methods: ['GET', 'POST'],
  }));

  // JSON body parser (needed for POST /admin/crawl/start)
  app.use(express.json({ limit: '1mb' }));

  // HTTP request logging
  app.use(pinoHttp({ logger }));

  // Health check (no auth required)
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', ts: new Date().toISOString() });
  });

  // Routes
  app.use('/search', searchRouter(deps.indexManager, deps.cache, deps.metrics));
  app.use('/autocomplete', autocompleteRouter(deps.indexManager));
  app.use('/doc', docRouter(deps.store));
  app.use('/admin', adminRouter(deps.indexManager, deps.metrics, deps.store, deps.redis));

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Centralized error handler
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : 'Internal server error';
    logger.error(err, 'Unhandled error');
    res.status(500).json({ error: message });
  });

  return app;
}
