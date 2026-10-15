/**
 * Robots.txt parser wrapper
 *
 * Fetches and caches robots.txt per domain (TTL: 1 hour).
 * Provides a single `isAllowed(url, userAgent)` method.
 */
export declare class RobotsCache {
    private readonly cache;
    /**
     * Returns true if `url` is allowed to be crawled for `userAgent`.
     * On fetch failure, defaults to allowing the URL (fail-open).
     */
    isAllowed(url: string, userAgent?: string): Promise<boolean>;
}
//# sourceMappingURL=robots.d.ts.map