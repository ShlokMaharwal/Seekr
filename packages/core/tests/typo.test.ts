import { describe, it, expect } from 'vitest';
import {
  levenshtein,
  bigrams,
  buildBigramIndex,
  findCandidates,
  didYouMean,
} from '../src/typo.js';

describe('levenshtein()', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('cat', 'cat')).toBe(0);
  });

  it('returns 1 for a single substitution', () => {
    expect(levenshtein('cat', 'bat')).toBe(1);
  });

  it('returns 1 for a single insertion', () => {
    expect(levenshtein('cat', 'cats')).toBe(1);
  });

  it('returns 1 for a single deletion', () => {
    expect(levenshtein('cats', 'cat')).toBe(1);
  });

  it('counts transposition as 1 edit (Damerau)', () => {
    // "teh" → "the": single transposition, so distance = 1 with Damerau
    expect(levenshtein('teh', 'the')).toBe(1);
    expect(levenshtein('adn', 'and')).toBe(1);
    expect(levenshtein('recieve', 'receive')).toBe(1);
  });

  it('handles empty strings', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
    expect(levenshtein('', '')).toBe(0);
  });

  it('returns maxDist+1 when distance exceeds maxDist (early exit)', () => {
    const dist = levenshtein('abcdefgh', 'xyz', 2);
    expect(dist).toBeGreaterThan(2);
  });

  it('computes distance for common misspellings', () => {
    expect(levenshtein('seach', 'search')).toBeLessThanOrEqual(2);
    expect(levenshtein('retreival', 'retrieval')).toBeLessThanOrEqual(2);
  });
});

describe('bigrams()', () => {
  it('returns correct bigrams', () => {
    expect(bigrams('cat')).toEqual(['ca', 'at']);
  });

  it('returns empty for single character', () => {
    expect(bigrams('a')).toHaveLength(0);
  });

  it('returns empty for empty string', () => {
    expect(bigrams('')).toHaveLength(0);
  });

  it('returns n-1 bigrams for n-char string', () => {
    const word = 'hello';
    expect(bigrams(word)).toHaveLength(word.length - 1);
  });
});

describe('buildBigramIndex()', () => {
  it('indexes terms by their bigrams', () => {
    const vocab = ['search', 'research', 'seach'];
    const idx = buildBigramIndex(vocab);
    // 'se' should map to terms containing that bigram
    expect(idx.has('se')).toBe(true);
    const seTerms = idx.get('se')!;
    expect(seTerms.has('search')).toBe(true);
    expect(seTerms.has('seach')).toBe(true);
  });
});

describe('findCandidates()', () => {
  it('finds the correct word for a misspelling', () => {
    const vocab = ['search', 'research', 'reach', 'teach', 'database', 'retrieval'];
    const idx = buildBigramIndex(vocab);
    const candidates = findCandidates('seach', idx, 2);
    const terms = candidates.map((c) => c.term);
    expect(terms).toContain('search');
  });

  it('returns candidates sorted by distance', () => {
    const vocab = ['cat', 'bat', 'hat', 'abcde'];
    const idx = buildBigramIndex(vocab);
    const candidates = findCandidates('cat', idx, 2);
    // All should be dist 1 (substitution)
    for (let i = 1; i < candidates.length; i++) {
      expect(candidates[i - 1]!.distance).toBeLessThanOrEqual(candidates[i]!.distance);
    }
  });

  it('excludes the query term itself', () => {
    const vocab = ['search', 'seach'];
    const idx = buildBigramIndex(vocab);
    const candidates = findCandidates('search', idx, 2);
    expect(candidates.every((c) => c.term !== 'search')).toBe(true);
  });

  it('returns empty array when no candidates within maxDist', () => {
    const vocab = ['zzz', 'yyy'];
    const idx = buildBigramIndex(vocab);
    const candidates = findCandidates('abc', idx, 1);
    // No bigram overlap → empty
    expect(candidates).toHaveLength(0);
  });
});

describe('didYouMean()', () => {
  it('suggests correction for misspelled query terms', () => {
    const vocab = ['search', 'engine', 'information', 'retrieval'];
    const idx = buildBigramIndex(vocab);
    // "seach" has 0 hits
    const hitCounts = new Map([['seach', 0], ['engine', 5]]);
    const suggestion = didYouMean(['seach', 'engine'], hitCounts, idx);
    expect(suggestion).not.toBeNull();
    expect(suggestion).toContain('search');
  });

  it('returns null when all terms have hits', () => {
    const vocab = ['search', 'engine'];
    const idx = buildBigramIndex(vocab);
    const hitCounts = new Map([['search', 10], ['engine', 5]]);
    const suggestion = didYouMean(['search', 'engine'], hitCounts, idx);
    expect(suggestion).toBeNull();
  });
});
