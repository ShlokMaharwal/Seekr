/**
 * URL Frontier – Redis-backed per-domain URL queues
 *
 * Design:
 *   - Each domain gets its own Redis list: "frontier:<domain>"
 *   - A global sorted set "frontier:domains" tracks domains with pending URLs,
 *     scored by their next-allowed-crawl timestamp (Unix ms). This enforces
 *     per-domain politeness delays without a centralized scheduler.
 *   - A Redis set "frontier:seen" holds all enqueued/crawled URL hashes to
 *     prevent duplicates before fetching.
 *
 * Politeness:
 *   When a domain is dequeued for processing, its next-allowed timestamp is
 *   updated to `now + delayMs`. The worker waits until that time before
 *   fetching the next URL from the same domain.
 *
 * Concurrency safety:
 *   All read-modify-write operations (peek domain, pop URL, update timestamp)
 *   are wrapped in a Lua script executed atomically by Redis, so multiple
 *   worker processes cannot crawl the same URL twice.
 */
import { type Redis } from 'ioredis';
export interface FrontierConfig {
    redis: Redis;
    delayMs?: number;
}
export declare class UrlFrontier {
    private readonly redis;
    private readonly delayMs;
    private readonly script;
    constructor({ redis, delayMs }: FrontierConfig);
    /**
     * Enqueue a URL if it hasn't been seen before.
     * Returns true if the URL was added, false if it was a duplicate.
     */
    enqueue(url: string, domain: string): Promise<boolean>;
    /**
     * Atomically dequeue the next URL from any domain whose politeness delay
     * has elapsed. Returns null if no URL is currently available.
     */
    dequeue(): Promise<{
        url: string;
        domain: string;
    } | null>;
    /** Total number of URLs waiting in all domain queues. */
    queueSize(): Promise<number>;
    /** Record a crawl event into the capped feed list. */
    recordEvent(url: string, status: 'success' | 'failed' | 'duplicate' | 'skipped'): Promise<void>;
    /** Mark a URL as seen without enqueueing (for content-duplicate suppression). */
    markSeen(url: string): Promise<void>;
    /** Check if a URL has already been seen. */
    hasSeen(url: string): Promise<boolean>;
    /** Reset the entire frontier (used by /admin/crawl/stop). */
    reset(): Promise<void>;
}
//# sourceMappingURL=frontier.d.ts.map