/**
 * Robots.txt parser wrapper
 *
 * Fetches and caches robots.txt per domain (TTL: 1 hour).
 * Provides a single `isAllowed(url, userAgent)` method.
 */
import { request } from 'undici';
import robotsParserPkg from 'robots-parser';
import { logger } from './logger.js';
const robotsParser = robotsParserPkg.default || robotsParserPkg;
const ROBOTS_TTL_MS = 60 * 60 * 1000; // 1 hour
const USER_AGENT = 'SeekerBot/1.0 (+https://github.com/seekr)';
export class RobotsCache {
    cache = new Map();
    /**
     * Returns true if `url` is allowed to be crawled for `userAgent`.
     * On fetch failure, defaults to allowing the URL (fail-open).
     */
    async isAllowed(url, userAgent = USER_AGENT) {
        const { hostname, protocol } = new URL(url);
        const domain = `${protocol}//${hostname}`;
        const cached = this.cache.get(domain);
        if (cached !== undefined && cached.expiresAt > Date.now()) {
            return cached.parser.isAllowed(url, userAgent) !== false;
        }
        // Fetch and cache
        try {
            const robotsUrl = `${domain}/robots.txt`;
            const { body, statusCode } = await request(robotsUrl, {
                method: 'GET',
                headersTimeout: 5000,
                bodyTimeout: 5000,
            });
            if (statusCode === 200) {
                const text = await body.text();
                const parser = robotsParser(robotsUrl, text);
                this.cache.set(domain, { parser, expiresAt: Date.now() + ROBOTS_TTL_MS });
                return parser.isAllowed(url, userAgent) !== false;
            }
        }
        catch (err) {
            logger.debug({ domain, err }, 'robots.txt fetch failed, defaulting to allow');
        }
        // On error or non-200, cache an allow-all parser
        const parser = robotsParser(`${domain}/robots.txt`, '');
        this.cache.set(domain, { parser, expiresAt: Date.now() + ROBOTS_TTL_MS });
        return true;
    }
}
//# sourceMappingURL=robots.js.map