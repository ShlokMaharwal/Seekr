import { describe, it, expect } from 'vitest';
import { generateSnippet } from '../src/snippet.js';
describe('snippets', () => {
  it('handles empty text and no matching terms', () => {
    expect(generateSnippet('', ['tree'])).toEqual({ text: '', highlights: [] });
    expect(generateSnippet('graph network', ['missing']).text).toBe('graph network');
  });
  it('selects the densest window and highlights stemmed words with valid offsets', () => {
    const text = `${'noise '.repeat(60)}binary trees are useful for searching ${'noise '.repeat(60)}`;
    const result = generateSnippet(text, ['binary', 'tree'], 8);
    expect(result.text).toContain('binary trees');
    expect(result.text.startsWith('…')).toBe(true);
    expect(result.highlights.map(([start, end]) => result.text.slice(start, end))).toEqual([
      'binary',
      'trees',
    ]);
  });
  it('keeps untrusted markup as plain text and bounds long snippets', () => {
    const result = generateSnippet('<script>alert(1)</script> binary tree', ['binary']);
    expect(result.text).toContain('<script>'); // JSON/plain text; React escapes it at rendering.
    expect(generateSnippet('verylongword'.repeat(100), ['word']).text.length).toBeLessThanOrEqual(
      301,
    );
  });
});
