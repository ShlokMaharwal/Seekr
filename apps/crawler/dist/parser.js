/**
 * HTML Parser
 *
 * Extracts:
 *   - Title (from <title> or <h1>)
 *   - Main text content (strips nav, header, footer, aside, script, style)
 *   - Outgoing links (normalized, filtered to allowed domains/prefixes)
 *
 * Uses cheerio for DOM manipulation. The content extraction heuristic
 * prefers <main>, <article>, or <div role="main"> before falling back
 * to <body>, which handles most documentation and Wikipedia-style pages.
 */
import * as cheerio from 'cheerio';
import { URL } from 'url';
import crypto from 'crypto';
// Tags to remove entirely before extracting text
const NOISE_TAGS = ['script', 'style', 'nav', 'header', 'footer', 'aside',
    'form', 'button', 'iframe', 'noscript', 'svg', 'figure'];
/**
 * Parse an HTML page and extract structured data.
 *
 * @param html         Raw HTML string.
 * @param baseUrl      The URL the page was fetched from (used to resolve relative links).
 * @param allowedPrefixes  If non-empty, only links whose href starts with one of
 *                     these prefixes are included in the output.
 */
export function parseHtml(html, baseUrl, allowedPrefixes = []) {
    const $ = cheerio.load(html);
    const base = new URL(baseUrl);
    // Remove noise elements
    $(NOISE_TAGS.join(',')).remove();
    $('[aria-hidden="true"]').remove();
    // Extract title
    const title = $('title').first().text().trim() ||
        $('h1').first().text().trim() ||
        base.hostname;
    // Find the main content area
    const contentEl = $('main').first() ||
        $('article').first() ||
        $('[role="main"]').first() ||
        $('body').first();
    const rawText = contentEl.text();
    // Collapse whitespace
    const text = rawText.replace(/\s+/g, ' ').trim();
    // Content hash for deduplication
    const normalized = text.toLowerCase().slice(0, 10_000);
    const contentHash = crypto.createHash('sha1').update(normalized).digest('hex');
    // Extract and normalize links
    const links = [];
    $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href)
            return;
        let resolved;
        try {
            resolved = new URL(href, baseUrl);
        }
        catch {
            return; // Malformed URL
        }
        // Only HTTP/HTTPS
        if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:')
            return;
        // Strip fragment
        resolved.hash = '';
        // Normalize trailing slash for path comparison
        const normalized = resolved.toString();
        // Filter to allowed prefixes if specified
        if (allowedPrefixes.length > 0) {
            const allowed = allowedPrefixes.some((p) => normalized.startsWith(p));
            if (!allowed)
                return;
        }
        links.push(normalized);
    });
    // Deduplicate links
    const uniqueLinks = [...new Set(links)];
    return { title, text, links: uniqueLinks, contentHash };
}
/**
 * Extract the domain (hostname) from a URL.
 * Returns the hostname for use as the frontier queue key.
 */
export function extractDomain(url) {
    try {
        return new URL(url).hostname;
    }
    catch {
        return url;
    }
}
//# sourceMappingURL=parser.js.map