import { describe, it, expect } from 'vitest';
import { createIndex, addDocument } from '../src/inverted-index.js';
import { buildBigramIndex } from '../src/typo.js';
import { search } from '../src/search-engine.js';

describe('full query semantics', () => {
  function fixture() {
    const index = createIndex();
    const texts = new Map<string, string>();
    ['binary tree', 'binary graph', 'binary the tree', 'graph network'].forEach((text, i) => {
      addDocument(index, String(i), text, '', '');
      texts.set(String(i), text);
    });
    return { index, texts, bigrams: buildBigramIndex(index.postings.keys()) };
  }
  it('enforces AND and OR terms', () => {
    const f = fixture();
    expect(search(f.index, 'binary tree', f.texts, f.bigrams).total).toBe(2);
    expect(search(f.index, 'tree OR network', f.texts, f.bigrams).total).toBe(3);
  });
  it('honors gaps left by stopwords in phrases', () => {
    const f = fixture();
    expect(
      search(f.index, '"binary the tree"', f.texts, f.bigrams).results.map((r) => r.docId),
    ).toEqual(['2']);
    expect(
      search(f.index, '"binary tree"', f.texts, f.bigrams).results.map((r) => r.docId),
    ).toEqual(['0']);
  });
  it('reports all matches independent of page and filters before top K', () => {
    const f = fixture();
    for (let i = 4; i < 60; i++) addDocument(f.index, String(i), 'binary tree', '', '');
    expect(search(f.index, '"binary tree"', f.texts, f.bigrams, { limit: 1 }).total).toBe(57);
    expect(search(f.index, '"binary the tree"', f.texts, f.bigrams, { limit: 1 }).total).toBe(1);
  });
});
