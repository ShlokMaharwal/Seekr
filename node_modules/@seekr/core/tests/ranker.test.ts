import { describe, it, expect, beforeEach } from 'vitest';
import { createIndex, addDocument } from '../src/inverted-index.js';
import { scoreBM25, scoreTFIDF } from '../src/ranker.js';
import type { InvertedIndex } from '../src/types.js';

function buildTestIndex(): InvertedIndex {
  const index = createIndex();
  addDocument(index, 'doc1', 'information retrieval search engine ranking', 'Doc 1', 'u1');
  addDocument(index, 'doc2', 'search engine optimization seo ranking algorithm', 'Doc 2', 'u2');
  addDocument(index, 'doc3', 'machine learning neural network deep learning', 'Doc 3', 'u3');
  addDocument(index, 'doc4', 'search search search information retrieval', 'Doc 4', 'u4');
  return index;
}

describe('BM25', () => {
  let index: InvertedIndex;
  beforeEach(() => { index = buildTestIndex(); });

  it('returns results for a matching query', () => {
    const results = scoreBM25(index, ['search', 'retriev'], 10);
    expect(results.length).toBeGreaterThan(0);
  });

  it('returns empty for a term not in the index', () => {
    const results = scoreBM25(index, ['xyznotexist'], 10);
    expect(results).toHaveLength(0);
  });

  it('ranks doc with higher TF higher (all else equal)', () => {
    // doc4 has "search" 3 times vs doc1/doc2's 1 time
    const results = scoreBM25(index, ['search'], 10);
    const doc4 = results.find((r) => r.docId === 'doc4');
    const doc1 = results.find((r) => r.docId === 'doc1');
    if (doc4 && doc1) {
      // BM25 saturates TF so doc4 should still score higher but not linearly
      expect(doc4.score).toBeGreaterThan(doc1.score);
    }
  });

  it('returns at most K results', () => {
    const results = scoreBM25(index, ['search'], 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('scores are positive', () => {
    const results = scoreBM25(index, ['search', 'retriev'], 10);
    expect(results.every((r) => r.score > 0)).toBe(true);
  });

  it('results are sorted descending by score', () => {
    const results = scoreBM25(index, ['search', 'retriev'], 10);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1]!.score).toBeGreaterThanOrEqual(results[i]!.score);
    }
  });

  it('accepts custom k1 and b parameters', () => {
    const r1 = scoreBM25(index, ['search'], 10, { k1: 1.2, b: 0.75 });
    const r2 = scoreBM25(index, ['search'], 10, { k1: 2.0, b: 0.5 });
    // Different params → different scores (not necessarily different order)
    expect(r1[0]!.score).not.toBe(r2[0]!.score);
  });
});

describe('TF-IDF', () => {
  let index: InvertedIndex;
  beforeEach(() => { index = buildTestIndex(); });

  it('returns results for a matching query', () => {
    const results = scoreTFIDF(index, ['search', 'retriev'], 10);
    expect(results.length).toBeGreaterThan(0);
  });

  it('results are sorted descending by score', () => {
    const results = scoreTFIDF(index, ['search'], 10);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1]!.score).toBeGreaterThanOrEqual(results[i]!.score);
    }
  });

  it('returns at most K results', () => {
    const results = scoreTFIDF(index, ['search'], 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('terms appearing in fewer docs get higher IDF weight', () => {
    // "machine" appears only in doc3, "search" appears in multiple docs
    // A query for "machine" should strongly rank doc3
    const results = scoreTFIDF(index, ['machin'], 10);
    if (results.length > 0) {
      expect(results[0]!.docId).toBe('doc3');
    }
  });
});

describe('MinHeap top-K behavior', () => {
  it('BM25 with K=1 returns only the best result', () => {
    const index = buildTestIndex();
    const results = scoreBM25(index, ['search', 'retriev'], 1);
    expect(results).toHaveLength(1);
  });

  it('TF-IDF with K=1 returns only the best result', () => {
    const index = buildTestIndex();
    const results = scoreTFIDF(index, ['search', 'retriev'], 1);
    expect(results).toHaveLength(1);
  });
});
