/**
 * API server entrypoint
 *
 * Boot sequence:
 *   1. Connect to Redis and MongoDB
 *   2. Load the index snapshot (or start fresh)
 *   3. Start the indexer consumer (Redis stream → in-memory index)
 *   4. Start the Express server
 *   5. Handle graceful shutdown on SIGTERM/SIGINT
 */

import { Redis } from 'ioredis';
import { createApp } from './app.js';
import { IndexManager } from './index-manager.js';
import { QueryCache } from './cache.js';
import { MetricsTracker } from './metrics.js';
import { DocumentStore } from './store.js';
import { logger } from './logger.js';

const PORT = parseInt(process.env['PORT'] ?? '4000', 10);
const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
const MONGO_URL = process.env['MONGO_URL'] ?? 'mongodb://localhost:27017';

async function main(): Promise<void> {
  logger.info({ PORT, REDIS_URL, MONGO_URL }, 'Seekr API starting');

  // Infrastructure
  const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: true });
  await redis.connect();

  const store = new DocumentStore();
  await store.connect(MONGO_URL);

  // Core services
  const indexManager = new IndexManager(redis, store);
  await indexManager.load();
  await indexManager.startIndexer();

  const cache = new QueryCache(redis);
  const metrics = new MetricsTracker(redis);

  // Express app
  const app = createApp({ indexManager, cache, metrics, store, redis });
  const server = app.listen(PORT, () => {
    logger.info({ PORT }, 'API server listening');
  });

  // Graceful shutdown
  async function shutdown(signal: string): Promise<void> {
    logger.info({ signal }, 'Shutting down');
    server.close();
    await indexManager.stop();
    await store.close();
    await redis.quit();
    process.exit(0);
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error(err, 'Fatal API error');
  process.exit(1);
});
