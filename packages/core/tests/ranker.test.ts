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
  beforeEach(() => {
    index = buildTestIndex();
  });

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
  beforeEach(() => {
    index = buildTestIndex();
  });

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

describe('Hand-calculated Reference Verification', () => {
  let refIndex: InvertedIndex;

  beforeEach(() => {
    refIndex = createIndex();
    // doc1: "cat dog" (2 tokens: |d1| = 2)
    addDocument(refIndex, 'doc1', 'cat dog', 'Cat and Dog', 'http://example.com/1');
    // doc2: "cat cat fish" (3 tokens: |d2| = 3)
    addDocument(refIndex, 'doc2', 'cat cat fish', 'Two Cats and Fish', 'http://example.com/2');
    // N = 2, avgDocLen = (2 + 3) / 2 = 2.5
  });

  it('verifies BM25 scores against hand-computed reference values', () => {
    // Expected scores calculated by hand:
    // N = 2, avgdl = 2.5, k1 = 1.2, b = 0.75
    // Query: "cat", df("cat") = 2
    // idf("cat") = ln((2 - 2 + 0.5) / (2 + 0.5) + 1) = ln(1.2) ≈ 0.1823215568
    // doc1 (tf=1, len=2): tfNorm = 2.2 / (1 + 1.2 * (0.25 + 0.75 * 0.8)) = 2.2 / 2.02 ≈ 1.0891089
    // Expected doc1 score: 0.1823215568 * 1.0891089 ≈ 0.198568
    // doc2 (tf=2, len=3): tfNorm = 4.4 / (2 + 1.2 * (0.25 + 0.75 * 1.2)) = 4.4 / 3.38 ≈ 1.3017751
    // Expected doc2 score: 0.1823215568 * 1.3017751 ≈ 0.237342
    const results = scoreBM25(refIndex, ['cat'], 10);
    expect(results).toHaveLength(2);

    const doc2 = results.find((r) => r.docId === 'doc2');
    const doc1 = results.find((r) => r.docId === 'doc1');
    expect(doc1).toBeDefined();
    expect(doc2).toBeDefined();

    expect(doc1!.score).toBeCloseTo(0.198568, 4);
    expect(doc2!.score).toBeCloseTo(0.237342, 4);

    // Multi-term query: "cat fish"
    // doc2 contains "fish" (df=1, tf=1, len=3)
    // idf("fish") = ln((2 - 1 + 0.5)/(1 + 0.5) + 1) = ln(2) ≈ 0.693147
    // tfNorm = 2.2 / (1 + 1.2 * 1.15) = 2.2 / 2.38 ≈ 0.924370
    // score("fish", doc2) = ln(2) * 2.2 / 2.38 ≈ 0.640724
    // total doc2 score = 0.237342 + 0.640724 ≈ 0.878066
    const multiResults = scoreBM25(refIndex, ['cat', 'fish'], 10);
    const multiDoc2 = multiResults.find((r) => r.docId === 'doc2');
    expect(multiDoc2!.score).toBeCloseTo(0.878066, 4);
  });

  it('verifies TF-IDF scores against hand-computed reference values', () => {
    // Expected scores calculated by hand:
    // N = 2, df("cat") = 2
    // idf("cat") = ln((2 + 1) / (2 + 1)) + 1 = 1.0
    // doc1 (tf=1): tfWeight = 1 + ln(1) = 1.0 => score = 1.0 * 1.0 = 1.0
    // doc2 (tf=2): tfWeight = 1 + ln(2) ≈ 1.693147 => score = 1.693147 * 1.0 = 1.693147
    const results = scoreTFIDF(refIndex, ['cat'], 10);
    expect(results).toHaveLength(2);

    const doc1 = results.find((r) => r.docId === 'doc1');
    const doc2 = results.find((r) => r.docId === 'doc2');
    expect(doc1!.score).toBeCloseTo(1.0, 5);
    expect(doc2!.score).toBeCloseTo(1.693147, 5);

    // Multi-term query: "cat fish"
    // df("fish") = 1 => idf("fish") = ln(3 / 2) + 1 = ln(1.5) + 1 ≈ 1.405465
    // doc2: "cat" score (1.693147) + "fish" score (1.0 * 1.405465) = 3.098612
    const multiResults = scoreTFIDF(refIndex, ['cat', 'fish'], 10);
    const multiDoc2 = multiResults.find((r) => r.docId === 'doc2');
    expect(multiDoc2!.score).toBeCloseTo(3.098612, 5);
  });
});
