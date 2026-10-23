import { describe, it, expect } from 'vitest';
import { createIndex, addDocument, scoreBM25, scoreBM25F, simHash, hammingDistance, simHashBands,
  encodeIndex, decodeIndex, encodeLegacyIndex, Trie, buildBigramIndex, didYouMean } from '../src/index.js';

describe('field ranking', () => {
  it('reduces to body BM25 with title weight zero', () => {
    const index = createIndex();
    addDocument(index, 'a', 'binary tree tree', 'A', 'a');
    addDocument(index, 'b', 'binary graph', 'Binary tree', 'b');
    const regular = scoreBM25(index, ['binari', 'tree']);
    const field = scoreBM25F(index, ['binari', 'tree'], 10, { titleWeight: 0 });
    for (const r of regular) expect(field.find(f => f.docId === r.docId)?.score).toBeCloseTo(r.score, 12);
    expect(scoreBM25F(index, ['tree'], 10, { titleWeight: 10 })[0]?.docId).toBe('b');
  });
});
describe('SimHash', () => {
  it('is deterministic, order independent, and distinguishes unrelated text', () => {
    expect(simHash('binary tree graph')).toBe(simHash('graph binary tree'));
    expect(hammingDistance(simHash('binary tree'), simHash('binary tree'))).toBe(0);
    expect(hammingDistance(simHash('binary tree graph algorithm'), simHash('cooking recipe oven kitchen'))).toBeGreaterThan(3);
    expect(simHashBands(simHash('binary tree'))).toHaveLength(4);
    expect(() => hammingDistance('bad', 'bad')).toThrow();
  });
});
describe('binary snapshots', () => {
  it('round trips fields, snippets, positions and legacy JSON', () => {
    const index = createIndex(); addDocument(index, 'external-id', 'binary the tree', 'Binary tree', 'https://example.org');
    const binary = decodeIndex(encodeIndex(index));
    expect(binary).toEqual(index);
    expect(decodeIndex(Buffer.from(encodeLegacyIndex(index)))).toEqual(index);
    const old = decodeIndex(Buffer.from(JSON.stringify({ version: 1, docs: [['a', 1, 'Title', 'u']], postings: [['tree', [['a', 1, [3]]]]] })));
    expect(old.postings.get('tree')?.[0]?.positions).toEqual([3]);
    expect(old.titlePostings.size).toBe(1);
  });
  it('rejects truncated or modified data', () => {
    const data = encodeIndex(createIndex());
    expect(() => decodeIndex(data.subarray(0, -1))).toThrow();
    const bad = Buffer.from(data); bad[bad.length - 1] = 255;
    expect(() => decodeIndex(bad)).toThrow('checksum');
  });
});
describe('cached autocomplete and per-term typo suggestions', () => {
  it('matches full traversal after inserts, boosts, and serialization', () => {
    const trie = new Trie();
    for (let i = 0; i < 40; i++) trie.insert(`term${i}`, i + 1);
    trie.increment('term0', 100);
    expect(trie.suggest('term')).toEqual(trie.suggestUncached('term'));
    expect(Trie.fromJSON(trie.toJSON()).suggest('term')).toEqual(trie.suggest('term'));
    expect(trie.suggest('term', 20)).toEqual(trie.suggestUncached('term', 20));
  });
  it('corrects multiple misspelled terms while keeping correctly spelled terms', () => {
    const bigrams = buildBigramIndex(['binary', 'tree', 'algorithm', 'search']);
    expect(didYouMean(['binry', 'tree', 'algoritm'], new Map([['tree', 1]]), bigrams)).toBe('binary tree algorithm');
  });
});
