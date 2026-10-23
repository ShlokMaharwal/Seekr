import { describe, it, expect } from 'vitest';
import { parseHtml, extractDomain } from '../src/parser.js';
import { parseCrawlConfig } from '../src/config.js';
describe('HTML parsing and crawl settings', () => {
  it('extracts useful content, normalizes links, and rejects lookalike origins', () => {
    const doc = parseHtml(
      '<title>Title</title><nav>noise</nav><main> useful text <script>bad</script><a href="/docs/a#b">A</a><a href="https://example.org.evil/docs/">Bad</a><a href="javascript:alert(1)">X</a></main>',
      'https://example.org/docs/',
      ['https://example.org/docs/'],
    );
    expect(doc.text).not.toContain('noise');
    expect(doc.text).not.toContain('bad');
    expect(doc.links).toEqual(['https://example.org/docs/a']);
    expect(doc.contentHash).toHaveLength(64);
    expect(doc.simHash).toHaveLength(16);
    expect(extractDomain('https://example.org/docs')).toBe('example.org');
  });
  it('hashes the full content rather than only its first 10,000 characters', () => {
    const prefix = 'repeat '.repeat(2000);
    expect(parseHtml(`<main>${prefix}first</main>`, 'https://example.org').contentHash).not.toBe(
      parseHtml(`<main>${prefix}second</main>`, 'https://example.org').contentHash,
    );
  });
  it('validates persisted crawler configuration without unsafe casts', () => {
    expect(parseCrawlConfig('{"seeds":["https://example.org"]}').workers).toBe(1);
    expect(() => parseCrawlConfig('{"seeds":["file:///tmp/a"]}')).toThrow();
    expect(() => parseCrawlConfig('{"seeds":[],"workers":99}')).toThrow();
    expect(() => parseCrawlConfig('{"seeds":[1]}')).toThrow();
  });
});
