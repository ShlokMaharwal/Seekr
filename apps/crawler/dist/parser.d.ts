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
export interface ParseResult {
    title: string;
    text: string;
    links: string[];
    /** SHA-1 hash of normalized text for content-level deduplication */
    contentHash: string;
}
/**
 * Parse an HTML page and extract structured data.
 *
 * @param html         Raw HTML string.
 * @param baseUrl      The URL the page was fetched from (used to resolve relative links).
 * @param allowedPrefixes  If non-empty, only links whose href starts with one of
 *                     these prefixes are included in the output.
 */
export declare function parseHtml(html: string, baseUrl: string, allowedPrefixes?: string[]): ParseResult;
/**
 * Extract the domain (hostname) from a URL.
 * Returns the hostname for use as the frontier queue key.
 */
export declare function extractDomain(url: string): string;
//# sourceMappingURL=parser.d.ts.map