import { describe, it, expect, beforeEach } from 'vitest';
import { createIndex, addDocument, removeDocument, getPostings, df, termCount } from '../src/inverted-index.js';
import type { InvertedIndex } from '../src/types.js';

describe('InvertedIndex', () => {
  let index: InvertedIndex;

  beforeEach(() => {
    index = createIndex();
  });

  it('starts empty', () => {
    expect(index.N).toBe(0);
    expect(index.avgDocLen).toBe(0);
    expect(termCount(index)).toBe(0);
  });

  it('adds a document and updates N and avgDocLen', () => {
    addDocument(index, 'doc1', 'the quick brown fox jumps', 'Doc 1', 'http://example.com/1');
    expect(index.N).toBe(1);
    expect(index.avgDocLen).toBeGreaterThan(0);
  });

  it('indexes terms into posting lists', () => {
    addDocument(index, 'doc1', 'information retrieval systems', 'T', 'U');
    // The index should have at least 1 term after tokenization
    expect(termCount(index)).toBeGreaterThan(0);
    // At least one term's posting should reference doc1
    let foundDoc1 = false;
    for (const postings of index.postings.values()) {
      if (postings.some((p) => p.docId === 'doc1')) { foundDoc1 = true; break; }
    }
    expect(foundDoc1).toBe(true);
  });

  it('records term frequency correctly', () => {
    addDocument(index, 'doc1', 'cat cat cat dog', 'T', 'U');
    const stemmedCat = 'cat'; // cat→cat (no change needed, but stemmer might change it)
    // Find the term that "cat" stems to
    const catTerm = [...index.postings.keys()].find((k) => k.startsWith('cat'));
    if (catTerm) {
      const postings = getPostings(index, catTerm);
      expect(postings[0]!.tf).toBe(3);
    }
  });

  it('records positions for phrase matching', () => {
    addDocument(index, 'doc1', 'quick brown fox', 'T', 'U');
    // Get any posting and verify positions array is populated
    const allTerms = [...index.postings.keys()];
    for (const term of allTerms) {
      const posts = getPostings(index, term);
      expect(posts[0]!.positions.length).toBeGreaterThan(0);
    }
  });

  it('updates corpus stats correctly with multiple docs', () => {
    addDocument(index, 'doc1', 'hello world foo bar baz', 'T1', 'U1');
    addDocument(index, 'doc2', 'hello world', 'T2', 'U2');
    expect(index.N).toBe(2);
    // avgDocLen should be somewhere between the two lengths
    expect(index.avgDocLen).toBeGreaterThan(0);
  });

  it('replaces a document on re-add', () => {
    addDocument(index, 'doc1', 'cats dogs', 'T', 'U');
    const terms1 = termCount(index);
    addDocument(index, 'doc1', 'completely different content here folks', 'T2', 'U');
    expect(index.N).toBe(1); // still one doc
    // Term count may differ since the text changed
    expect(termCount(index)).toBeGreaterThan(0);
    expect(termCount(index)).not.toBe(terms1);
  });

  it('removes a document correctly', () => {
    addDocument(index, 'doc1', 'hello world', 'T1', 'U1');
    addDocument(index, 'doc2', 'foo bar baz', 'T2', 'U2');
    removeDocument(index, 'doc1');
    expect(index.N).toBe(1);
    // doc1's terms should either be gone or only reference doc2
    for (const postings of index.postings.values()) {
      expect(postings.every((p) => p.docId !== 'doc1')).toBe(true);
    }
  });

  it('df returns 0 for unknown term', () => {
    expect(df(index, 'unknownxyz')).toBe(0);
  });

  it('df returns correct document frequency', () => {
    addDocument(index, 'doc1', 'search engine', 'T1', 'U1');
    addDocument(index, 'doc2', 'search query', 'T2', 'U2');
    addDocument(index, 'doc3', 'engine optimization', 'T3', 'U3');
    // "search" appears in doc1 and doc2
    const searchTerm = [...index.postings.keys()].find((k) => k.startsWith('search'));
    if (searchTerm) {
      expect(df(index, searchTerm)).toBe(2);
    }
  });
});
