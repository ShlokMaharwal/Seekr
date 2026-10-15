import { describe, it, expect } from 'vitest';
import { parseQuery, extractTerms, phraseMatchesDoc } from '../src/query-parser.js';

describe('parseQuery()', () => {
  it('parses a single term', () => {
    const clause = parseQuery('cats');
    expect(clause.type).toBe('term');
    if (clause.type === 'term') {
      expect(clause.value).toBeTruthy(); // stemmed
    }
  });

  it('parses multiple terms as AND', () => {
    const clause = parseQuery('cats dogs');
    expect(clause.type).toBe('and');
    if (clause.type === 'and') {
      expect(clause.clauses.length).toBe(2);
    }
  });

  it('parses OR query', () => {
    const clause = parseQuery('cats OR dogs');
    expect(clause.type).toBe('or');
    if (clause.type === 'or') {
      expect(clause.clauses.length).toBe(2);
    }
  });

  it('parses a phrase query', () => {
    const clause = parseQuery('"quick brown fox"');
    expect(clause.type).toBe('phrase');
    if (clause.type === 'phrase') {
      expect(clause.tokens.length).toBe(3);
    }
  });

  it('parses mixed phrase and term', () => {
    const clause = parseQuery('"quick brown" fox');
    expect(clause.type).toBe('and');
    if (clause.type === 'and') {
      const phraseClause = clause.clauses.find((c) => c.type === 'phrase');
      expect(phraseClause).toBeDefined();
    }
  });

  it('returns empty AND for empty input', () => {
    const clause = parseQuery('');
    expect(clause.type).toBe('and');
    if (clause.type === 'and') {
      expect(clause.clauses).toHaveLength(0);
    }
  });

  it('filters stopwords from plain terms', () => {
    // "the" is a stopword
    const clause = parseQuery('the quick');
    // Should only produce a single term for "quick"
    const terms = extractTerms(clause);
    expect(terms).not.toContain('the');
  });
});

describe('extractTerms()', () => {
  it('extracts terms from AND clause', () => {
    const clause = parseQuery('cats dogs birds');
    const terms = extractTerms(clause);
    expect(terms.length).toBe(3);
  });

  it('extracts terms from OR clause', () => {
    const clause = parseQuery('cats OR dogs');
    const terms = extractTerms(clause);
    expect(terms.length).toBe(2);
  });

  it('extracts terms from phrase', () => {
    const clause = parseQuery('"quick brown fox"');
    const terms = extractTerms(clause);
    expect(terms.length).toBeGreaterThan(0);
  });

  it('deduplicates terms', () => {
    const clause = parseQuery('cat cat dog');
    const terms = extractTerms(clause);
    const unique = new Set(terms);
    expect(unique.size).toBe(terms.length);
  });
});

describe('phraseMatchesDoc()', () => {
  it('returns true for a phrase that exists consecutively', () => {
    // positions: quick=0, brown=1, fox=2
    const docPositions = new Map([
      ['quick', [0, 5]],
      ['brown', [1, 8]],
      ['fox',   [2, 12]],
    ]);
    expect(phraseMatchesDoc(['quick', 'brown', 'fox'], docPositions)).toBe(true);
  });

  it('returns false when terms are not consecutive', () => {
    const docPositions = new Map([
      ['quick', [0]],
      ['brown', [5]], // gap of 5, not consecutive
    ]);
    expect(phraseMatchesDoc(['quick', 'brown'], docPositions)).toBe(false);
  });

  it('returns false when a phrase term is missing', () => {
    const docPositions = new Map([
      ['quick', [0]],
      // 'brown' is missing
    ]);
    expect(phraseMatchesDoc(['quick', 'brown'], docPositions)).toBe(false);
  });

  it('returns false for empty phrase', () => {
    expect(phraseMatchesDoc([], new Map())).toBe(false);
  });

  it('handles single-term phrase', () => {
    const docPositions = new Map([['cat', [3, 7]]]);
    expect(phraseMatchesDoc(['cat'], docPositions)).toBe(true);
  });
});
