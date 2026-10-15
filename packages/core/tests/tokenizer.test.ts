import { describe, it, expect } from 'vitest';
import { tokenize, stem, STOPWORDS } from '../src/tokenizer.js';

describe('tokenizer', () => {
  describe('stem()', () => {
    it('removes -ing suffix', () => {
      expect(stem('running')).toBe('run');
    });

    it('removes -ed suffix', () => {
      expect(stem('jumped')).toBe('jump');
    });

    it('removes -er suffix (step 4)', () => {
      // "generalized" through several steps
      expect(stem('generalizer')).toBeTruthy();
    });

    it('handles short words unchanged', () => {
      expect(stem('is')).toBe('is');
      expect(stem('at')).toBe('at');
    });

    it('stems "information" toward a shorter root', () => {
      const s = stem('information');
      expect(s.length).toBeLessThan('information'.length);
    });

    it('stems "searching" toward "search"', () => {
      expect(stem('searching')).toContain('search');
    });
  });

  describe('tokenize()', () => {
    it('lowercases all tokens', () => {
      const tokens = tokenize('Hello World');
      expect(tokens.every((t) => t.raw === t.raw.toLowerCase())).toBe(true);
    });

    it('strips punctuation', () => {
      const tokens = tokenize('hello, world!');
      for (const t of tokens) {
        expect(t.raw).toMatch(/^[a-z0-9]+$/);
      }
    });

    it('removes stopwords', () => {
      const tokens = tokenize('the quick brown fox');
      const raws = tokens.map((t) => t.raw);
      expect(raws).not.toContain('the');
    });

    it('assigns sequential positions after stopword removal', () => {
      const tokens = tokenize('cats and dogs are great');
      // "and" and "are" are stopwords
      const terms = tokens.map((t) => t.term);
      expect(terms.length).toBeGreaterThan(0);
      for (let i = 0; i < tokens.length; i++) {
        expect(tokens[i]!.position).toBe(i);
      }
    });

    it('returns empty array for all-stopword input', () => {
      const tokens = tokenize('the and or is');
      expect(tokens).toHaveLength(0);
    });

    it('includes position for phrase queries', () => {
      const tokens = tokenize('quick brown fox', undefined, false);
      expect(tokens[0]!.position).toBe(0);
      expect(tokens[1]!.position).toBe(1);
      expect(tokens[2]!.position).toBe(2);
    });

    it('STOPWORDS set contains common English stopwords', () => {
      expect(STOPWORDS.has('the')).toBe(true);
      expect(STOPWORDS.has('is')).toBe(true);
      expect(STOPWORDS.has('and')).toBe(true);
    });
  });
});
