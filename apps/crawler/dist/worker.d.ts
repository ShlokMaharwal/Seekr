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
export declare const INDEXER_STREAM = "stream:new-docs";
export interface CrawlerConfig {
    redisUrl?: string;
    mongoUrl?: string;
    concurrency?: number;
    delayMs?: number;
    maxPages?: number;
    allowedPrefixes?: string[];
}
export declare class CrawlerWorker {
    private readonly redis;
    private readonly frontier;
    private readonly robots;
    private readonly store;
    private readonly config;
    private running;
    private paused;
    private crawledCount;
    constructor(config?: CrawlerConfig);
    start(): Promise<void>;
    pause(): void;
    resume(): void;
    stop(): Promise<void>;
    private runLoop;
    private processUrl;
}
//# sourceMappingURL=worker.d.ts.map