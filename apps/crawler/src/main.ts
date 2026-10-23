/**
 * Crawler entrypoint.
 *
 * Waits for crawl commands from the API using Redis control keys.
 */

import { Redis } from 'ioredis';
import { CrawlerWorker } from './worker.js';
import { UrlFrontier } from './frontier.js';
import { logger } from './logger.js';
import { parseCrawlConfig } from './config.js';

const K_CONTROL = 'crawl:control';
const K_CONFIG = 'crawl:config';

async function main(): Promise<void> {
  const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

  const mongoUrl = process.env['MONGO_URL'] ?? 'mongodb://localhost:27017';

  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
  });

  logger.info({ redisUrl }, 'Crawler entrypoint waiting for start signal');

  try {
    while (true) {
      const cmd = await redis.get(K_CONTROL);
      if (cmd === 'stop') {
        await new UrlFrontier({ redis }).reset();
        await redis.set(K_CONTROL, 'stopped');
        continue;
      }

      if (cmd !== 'start') {
        await sleep(1000);
        continue;
      }

      const configRaw = await redis.get(K_CONFIG);

      const config = parseCrawlConfig(configRaw);

      logger.info({ config }, 'Starting crawl');

      // Prevent an old "start" command from launching repeatedly.
      await redis.set(K_CONTROL, 'running');

      const frontier = new UrlFrontier({
        redis,
        delayMs: config.delayMs,
      });

      for (const seed of config.seeds) {
        try {
          const parsedUrl = new URL(seed);

          if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            logger.warn({ seed }, 'Unsupported seed URL protocol');
            continue;
          }

          await frontier.enqueue(seed, parsedUrl.hostname);
        } catch {
          logger.warn({ seed }, 'Invalid seed URL');
        }
      }

      const worker = new CrawlerWorker({
        redisUrl,
        mongoUrl,
        concurrency: config.workers,
        delayMs: config.delayMs,
        maxPages: config.maxPages,
        allowedPrefixes: config.seeds,
      });

      const watcher = watchControl(redis, worker);

      try {
        await worker.start();
      } catch (err) {
        logger.error({ err }, 'Crawler worker terminated unexpectedly');
      } finally {
        // Tell the watcher to exit after worker.start() completes.
        await redis.set(K_CONTROL, 'stopped');
      }

      await watcher;

      logger.info('Crawl cycle finished');
    }
  } finally {
    await redis.quit();
  }
}

async function watchControl(redis: Redis, worker: CrawlerWorker): Promise<void> {
  while (true) {
    const cmd = await redis.get(K_CONTROL);

    if (cmd === 'pause') {
      worker.pause();
    } else if (cmd === 'resume') {
      worker.resume();
    } else if (cmd === 'stop') {
      await worker.stop();
      return;
    } else if (cmd === 'stopped') {
      return;
    }

    await sleep(250);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  logger.error({ err }, 'Fatal crawler error');
  process.exit(1);
});
