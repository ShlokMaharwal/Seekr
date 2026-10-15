/**
 * HTML Fetcher
 *
 * Fetches a URL with:
 *   - Configurable timeout (default 10s)
 *   - Automatic redirect following (max 5 hops, handled by undici)
 *   - Exponential backoff retry (max 3 attempts)
 *   - Only processes HTML responses (skips binary, CSS, JS)
 */
import { request } from 'undici';
import { logger } from './logger.js';
const MAX_RETRIES = 3;
const TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB
/**
 * Fetch a URL and return its HTML content.
 * Throws on non-recoverable errors (4xx, non-HTML content-type, etc.).
 */
export async function fetchUrl(url) {
    let lastError;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const { body, statusCode, headers } = await request(url, {
                method: 'GET',
                maxRedirections: 5,
                headersTimeout: TIMEOUT_MS,
                bodyTimeout: TIMEOUT_MS,
                headers: {
                    'User-Agent': 'SeekerBot/1.0',
                    'Accept': 'text/html,application/xhtml+xml',
                },
            });
            const contentType = (headers['content-type'] ?? '');
            // Skip non-HTML responses immediately (no retry)
            if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
                await body.dump();
                throw Object.assign(new Error('Non-HTML content-type'), { permanent: true });
            }
            if (statusCode >= 400 && statusCode < 500) {
                await body.dump();
                throw Object.assign(new Error(`HTTP ${statusCode}`), { permanent: true });
            }
            if (statusCode >= 500) {
                await body.dump();
                throw new Error(`HTTP ${statusCode}`);
            }
            // Read body up to MAX_BODY_BYTES
            const chunks = [];
            let totalBytes = 0;
            for await (const chunk of body) {
                const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                totalBytes += buf.byteLength;
                chunks.push(buf);
                if (totalBytes > MAX_BODY_BYTES)
                    break;
            }
            const html = Buffer.concat(chunks).toString('utf8');
            return { url, html, statusCode };
        }
        catch (err) {
            lastError = err;
            // Don't retry permanent errors
            if (err.permanent)
                throw err;
            if (attempt < MAX_RETRIES) {
                const delay = 500 * Math.pow(2, attempt - 1); // 500ms, 1000ms, 2000ms
                logger.warn({ url, attempt, delay }, 'Fetch failed, retrying');
                await sleep(delay);
            }
        }
    }
    throw lastError;
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=fetcher.js.map