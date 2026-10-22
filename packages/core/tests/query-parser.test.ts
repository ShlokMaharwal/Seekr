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

  it('correctly handles phrases with removed stopwords using relative offsets', () => {
    // "binary the tree" in text: binary at pos 0, the (stopword, skipped), tree at pos 2
    const docWithStopword = new Map([
      ['binari', [0]],
      ['tree', [2]],
    ]);

    // "binary tree" in text: binary at pos 0, tree at pos 1
    const docAdjacent = new Map([
      ['binari', [0]],
      ['tree', [1]],
    ]);

    // Phrase: "binary the tree" -> terms: ['binari', 'tree'], offsets: [0, 2]
    const parsedWithStop = parseQuery('"binary the tree"');
    expect(parsedWithStop.type).toBe('phrase');
    if (parsedWithStop.type === 'phrase') {
      expect(parsedWithStop.tokens).toEqual(['binari', 'tree']);
      expect(parsedWithStop.offsets).toEqual([0, 2]);

      // Matches docWithStopword, but NOT docAdjacent
      expect(phraseMatchesDoc(parsedWithStop.tokens, docWithStopword, parsedWithStop.offsets)).toBe(true);
      expect(phraseMatchesDoc(parsedWithStop.tokens, docAdjacent, parsedWithStop.offsets)).toBe(false);
    }

    // Phrase: "binary tree" -> terms: ['binari', 'tree'], offsets: [0, 1]
    const parsedAdjacent = parseQuery('"binary tree"');
    expect(parsedAdjacent.type).toBe('phrase');
    if (parsedAdjacent.type === 'phrase') {
      expect(parsedAdjacent.tokens).toEqual(['binari', 'tree']);
      expect(parsedAdjacent.offsets).toEqual([0, 1]);

      // Matches docAdjacent, but NOT docWithStopword
      expect(phraseMatchesDoc(parsedAdjacent.tokens, docAdjacent, parsedAdjacent.offsets)).toBe(true);
      expect(phraseMatchesDoc(parsedAdjacent.tokens, docWithStopword, parsedAdjacent.offsets)).toBe(false);
    }
  });
});
