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
import cors from 'cors';
import pinoHttpPkg from 'pino-http';
const pinoHttp = pinoHttpPkg.default || pinoHttpPkg;
import { logger } from './logger.js';
import { searchRouter } from './routes/search.js';
import { autocompleteRouter } from './routes/autocomplete.js';
import { docRouter } from './routes/doc.js';
import { adminRouter } from './routes/admin.js';
export function createApp(deps) {
    const app = express();
    // CORS – allow the Seekr frontend origin
    app.use(cors({
        origin: [
            'http://localhost:5173',
            'http://localhost:3000',
        ],
        methods: ['GET', 'POST'],
    }));
    // JSON body parser (needed for POST /admin/crawl/start)
    app.use(express.json({ limit: '1mb' }));
    // HTTP request logging
    app.use(pinoHttp({ logger }));
    // Health check (no auth required)
    app.get('/health', (_req, res) => {
        res.json({ status: 'ok', ts: new Date().toISOString() });
    });
    // Routes
    app.use('/search', searchRouter(deps.indexManager, deps.cache, deps.metrics));
    app.use('/autocomplete', autocompleteRouter(deps.indexManager));
    app.use('/doc', docRouter(deps.store));
    app.use('/admin', adminRouter(deps.indexManager, deps.metrics, deps.store, deps.redis));
    // 404 handler
    app.use((_req, res) => {
        res.status(404).json({ error: 'Not found' });
    });
    // Centralized error handler
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    app.use((err, _req, res, _next) => {
        const message = err instanceof Error ? err.message : 'Internal server error';
        logger.error(err, 'Unhandled error');
        res.status(500).json({ error: message });
    });
    return app;
}
//# sourceMappingURL=app.js.map