/**
 * Express application factory
 *
 * Wires together:
 *   - CORS (configurable via CORS_ORIGINS env var)
 *   - JSON body parser
 *   - Pino HTTP request logging
 *   - Admin auth middleware (Bearer token from ADMIN_TOKEN env var)
 *   - All route handlers
 *   - Centralized error handler
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
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

/** Default allowed origins for local development */
const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:8080',
];

/**
 * Parse allowed CORS origins from environment or fall back to dev defaults.
 * CORS_ORIGINS is a comma-separated list of allowed origins.
 */
function parseCorsOrigins(): string[] {
  const envOrigins = process.env['CORS_ORIGINS'];
  if (envOrigins) {
    return envOrigins.split(',').map((o) => o.trim()).filter(Boolean);
  }
  return DEFAULT_ORIGINS;
}

/**
 * Admin auth middleware.
 * Requires `Authorization: Bearer <ADMIN_TOKEN>` on every /admin/* route.
 * If ADMIN_TOKEN is unset:
 *   - In production (NODE_ENV=production): refuses to mount admin routes.
 *   - In development: allows unauthenticated access with a warning.
 */
function adminAuth(): express.RequestHandler {
  const token = process.env['ADMIN_TOKEN'];
  const isProduction = process.env['NODE_ENV'] === 'production';

  if (!token && isProduction) {
    logger.error('ADMIN_TOKEN is not set in production — admin routes will reject all requests');
    return (_req: Request, res: Response) => {
      res.status(503).json({ error: 'Admin routes are disabled. Set ADMIN_TOKEN to enable.' });
    };
  }

  if (!token) {
    logger.warn('ADMIN_TOKEN is not set — admin routes are unprotected (dev mode)');
    return (_req: Request, _res: Response, next: NextFunction) => {
      next();
    };
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }
    const provided = authHeader.slice('Bearer '.length);
    if (provided !== token) {
      res.status(403).json({ error: 'Invalid admin token' });
      return;
    }
    next();
  };
}

export function createApp(deps: {
  indexManager: IndexManager;
  cache: QueryCache;
  metrics: MetricsTracker;
  store: DocumentStore;
  redis: Redis;
}): express.Application {
  const app = express();

  // CORS – configurable via CORS_ORIGINS env var, with localhost dev defaults
  const allowedOrigins = parseCorsOrigins();
  app.use(cors({
    origin: allowedOrigins,
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

  // Public routes
  app.use('/search', searchRouter(deps.indexManager, deps.cache, deps.metrics));
  app.use('/autocomplete', autocompleteRouter(deps.indexManager));
  app.use('/doc', docRouter(deps.store));

  // Admin routes – protected by Bearer token
  app.use('/admin', adminAuth(), adminRouter(deps.indexManager, deps.metrics, deps.store, deps.redis));

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
