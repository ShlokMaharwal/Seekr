import { describe, it, expect } from 'vitest';
import {
  createIndex,
  addDocument,
  removeDocument,
  buildBigramIndex,
  search,
  Trie,
  encodeIndex,
  decodeIndex,
  addTermToBigramIndex,
  findCandidates,
} from '../src/index.js';

describe('field and lifecycle edge cases', () => {
  it('matches title phrases without matching across title and body boundaries', () => {
    const index = createIndex();
    addDocument(index, 'title', 'unrelated content', 'Binary tree', 'u');
    addDocument(index, 'split', 'tree', 'Binary', 'v');
    const bigrams = buildBigramIndex([...index.postings.keys(), ...index.titlePostings.keys()]);
    expect(
      search(index, '"binary tree"', new Map(), bigrams, { bm25: { titleWeight: 2 } }).results.map(
        (r) => r.docId,
      ),
    ).toEqual(['title']);
    expect(search(index, 'binary', new Map(), bigrams).total).toBe(0);
    expect(search(index, '', new Map(), bigrams).total).toBe(0);
    expect(() => search(index, 'tree', new Map(), bigrams, { page: 0 })).toThrow();
    removeDocument(index, 'title');
    removeDocument(index, 'split');
    expect(index.avgTitleLen).toBe(0);
    expect(index.titlePostings.size).toBe(0);
    expect(decodeIndex(encodeIndex(index))).toEqual(index);
  });
  it('updates incremental bigrams and handles trie cache boundary cases', () => {
    const bigrams = buildBigramIndex([]);
    addTermToBigramIndex(bigrams, 'algorithm');
    expect(findCandidates('algoritm', bigrams)[0]?.term).toBe('algorithm');
    const trie = new Trie();
    trie.insert('');
    trie.insert('term', 0);
    trie.increment('missing');
    expect(trie.size).toBe(0);
    expect(trie.suggest('a', 0)).toEqual([]);
    for (let i = 0; i < 30; i++) trie.insert(`a${i}`, i + 1);
    expect(trie.suggest('a', 15)).toEqual(trie.suggestUncached('a', 15));
    trie.clear();
    expect(trie.suggest('a')).toEqual([]);
  });
});
