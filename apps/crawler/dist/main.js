/**
 * Crawler entrypoint
 *
 * Reads configuration from environment variables and starts the worker.
 * The crawl is initiated by the API via Redis control keys.
 */
import { Redis } from 'ioredis';
import { CrawlerWorker } from './worker.js';
import { UrlFrontier } from './frontier.js';
import { logger } from './logger.js';
// Control keys written by the API
const K_CONTROL = 'crawl:control'; // string: 'start' | 'pause' | 'resume' | 'stop'
const K_CONFIG = 'crawl:config'; // JSON: { seeds, maxPages, delayMs, workers }
async function main() {
    const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
    const mongoUrl = process.env['MONGO_URL'] ?? 'mongodb://localhost:27017';
    const redis = new Redis(redisUrl, { maxRetriesPerRequest: 3 });
    logger.info({ redisUrl }, 'Crawler entrypoint waiting for start signal');
    // Poll the control key
    while (true) {
        const cmd = await redis.get(K_CONTROL);
        if (cmd === 'start') {
            // Read config
            const configRaw = await redis.get(K_CONFIG);
            const config = configRaw
                ? JSON.parse(configRaw)
                : { seeds: [], maxPages: 10_000, delayMs: 500, workers: 1 };
            logger.info({ config }, 'Starting crawl');
            // Seed the frontier
            const frontier = new UrlFrontier({ redis, delayMs: config.delayMs });
            for (const seed of config.seeds) {
                try {
                    const { hostname } = new URL(seed);
                    await frontier.enqueue(seed, hostname);
                }
                catch {
                    logger.warn({ seed }, 'Invalid seed URL');
                }
            }
            // Start the worker
            const worker = new CrawlerWorker({
                redisUrl,
                mongoUrl,
                delayMs: config.delayMs,
                maxPages: config.maxPages,
                allowedPrefixes: config.seeds,
            });
            // Watch for pause/stop commands in background
            const watchPromise = watchControl(redis, worker);
            await redis.set(K_CONTROL, 'running');
            await worker.start();
            await redis.set(K_CONTROL, 'stopped');
            await watchPromise;
        }
        else {
            await sleep(1000);
        }
    }
}
async function watchControl(redis, worker) {
    while (true) {
        const cmd = await redis.get(K_CONTROL);
        if (cmd === 'pause')
            worker.pause();
        else if (cmd === 'resume')
            worker.resume();
        else if (cmd === 'stop') {
            await worker.stop();
            break;
        }
        await sleep(500);
    }
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
main().catch((err) => {
    logger.error(err, 'Fatal crawler error');
    process.exit(1);
});
//# sourceMappingURL=main.js.map