/**
 * Crawler Worker
 *
 * A single worker process that:
 *   1. Pulls URLs from the Redis frontier
 *   2. Fetches + parses each page
 *   3. Stores documents in MongoDB
 *   4. Publishes new documents to a Redis stream for the indexer
 *   5. Enqueues discovered links back into the frontier
 *
 * Multiple worker instances can run concurrently (via --scale crawler=N in
 * Docker Compose). URL deduplication is handled atomically by the frontier's
 * Lua scripts, so no URL is crawled twice across workers.
 */
import { Redis } from 'ioredis';
import { UrlFrontier } from './frontier.js';
import { RobotsCache } from './robots.js';
import { fetchUrl } from './fetcher.js';
import { parseHtml, extractDomain } from './parser.js';
import { DocumentStore } from './store.js';
import { logger } from './logger.js';
// Redis stream key: indexer consumes new documents from this stream
export const INDEXER_STREAM = 'stream:new-docs';
export class CrawlerWorker {
    redis;
    frontier;
    robots;
    store;
    config;
    running = false;
    paused = false;
    crawledCount = 0;
    constructor(config = {}) {
        this.config = {
            redisUrl: config.redisUrl ?? (process.env['REDIS_URL'] ?? 'redis://localhost:6379'),
            mongoUrl: config.mongoUrl ?? (process.env['MONGO_URL'] ?? 'mongodb://localhost:27017'),
            concurrency: config.concurrency ?? 5,
            delayMs: config.delayMs ?? 500,
            maxPages: config.maxPages ?? Infinity,
            allowedPrefixes: config.allowedPrefixes ?? [],
        };
        this.redis = new Redis(this.config.redisUrl, { maxRetriesPerRequest: 3 });
        this.frontier = new UrlFrontier({ redis: this.redis, delayMs: this.config.delayMs });
        this.robots = new RobotsCache();
        this.store = new DocumentStore();
    }
    async start() {
        await this.store.connect(this.config.mongoUrl);
        this.running = true;
        logger.info({ config: this.config }, 'Crawler worker starting');
        // Run concurrent fetch loops
        const workers = Array.from({ length: this.config.concurrency }, () => this.runLoop());
        await Promise.all(workers);
    }
    pause() {
        this.paused = true;
        logger.info('Crawler paused');
    }
    resume() {
        this.paused = false;
        logger.info('Crawler resumed');
    }
    async stop() {
        this.running = false;
        await this.store.close();
        await this.redis.quit();
        logger.info('Crawler stopped');
    }
    // ---------------------------------------------------------------------------
    // Core loop
    // ---------------------------------------------------------------------------
    async runLoop() {
        while (this.running) {
            if (this.paused) {
                await sleep(500);
                continue;
            }
            if (this.crawledCount >= this.config.maxPages) {
                this.running = false;
                break;
            }
            const next = await this.frontier.dequeue();
            if (next === null) {
                // Empty queue — back off briefly
                await sleep(200);
                continue;
            }
            await this.processUrl(next.url);
            this.crawledCount++;
        }
    }
    async processUrl(url) {
        logger.debug({ url }, 'Processing URL');
        // Check robots.txt
        const allowed = await this.robots.isAllowed(url);
        if (!allowed) {
            await this.frontier.recordEvent(url, 'skipped');
            logger.debug({ url }, 'Blocked by robots.txt');
            return;
        }
        try {
            const { html } = await fetchUrl(url);
            const parsed = parseHtml(html, url, this.config.allowedPrefixes);
            // Content-level deduplication
            if (await this.store.existsByContentHash(parsed.contentHash)) {
                await this.frontier.recordEvent(url, 'duplicate');
                return;
            }
            // Build document ID from URL hash
            const id = urlId(url);
            const wordCount = parsed.text.split(/\s+/).filter(Boolean).length;
            const doc = {
                id,
                url,
                title: parsed.title,
                text: parsed.text,
                crawledAt: new Date().toISOString(),
                wordCount,
                contentHash: parsed.contentHash,
            };
            const isNew = await this.store.upsert(doc);
            if (isNew) {
                // Publish to indexer stream
                await this.redis.xadd(INDEXER_STREAM, '*', 'id', id, 'url', url, 'title', parsed.title, 'text', parsed.text.slice(0, 100_000), // cap at 100KB in stream
                'crawledAt', doc.crawledAt, 'wordCount', String(wordCount));
            }
            await this.frontier.recordEvent(url, 'success');
            logger.info({ url, wordCount, isNew }, 'Page crawled');
            // Enqueue outgoing links
            for (const link of parsed.links) {
                const domain = extractDomain(link);
                await this.frontier.enqueue(link, domain);
            }
        }
        catch (err) {
            await this.frontier.recordEvent(url, 'failed');
            logger.warn({ url, err }, 'Crawl failed');
        }
    }
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function urlId(url) {
    // Use a short deterministic ID derived from the URL
    let hash = 5381;
    for (let i = 0; i < url.length; i++) {
        hash = ((hash << 5) + hash + url.charCodeAt(i)) >>> 0;
    }
    return hash.toString(36);
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=worker.js.map