/**
 * HTML Fetcher
 *
 * Fetches a URL with:
 *   - Configurable timeout (default 10s)
 *   - Automatic redirect following (max 5 hops, handled by undici)
 *   - Exponential backoff retry (max 3 attempts)
 *   - Only processes HTML responses (skips binary, CSS, JS)
 */
export interface FetchResult {
    url: string;
    html: string;
    statusCode: number;
}
/**
 * Fetch a URL and return its HTML content.
 * Throws on non-recoverable errors (4xx, non-HTML content-type, etc.).
 */
export declare function fetchUrl(url: string): Promise<FetchResult>;
//# sourceMappingURL=fetcher.d.ts.map