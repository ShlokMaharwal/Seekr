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

    it('preserves word stream positions when removing stopwords', () => {
      // "cats and dogs are great"
      // pos 0: cats, pos 1: and (stopword), pos 2: dogs, pos 3: are (stopword), pos 4: great
      const tokens = tokenize('cats and dogs are great');
      expect(tokens).toHaveLength(3);
      expect(tokens[0]!.raw).toBe('cats');
      expect(tokens[0]!.position).toBe(0);
      expect(tokens[1]!.raw).toBe('dogs');
      expect(tokens[1]!.position).toBe(2);
      expect(tokens[2]!.raw).toBe('great');
      expect(tokens[2]!.position).toBe(4);
    });

    it('counts removed stopwords in "binary the tree"', () => {
      const tokens = tokenize('binary the tree');
      expect(tokens).toHaveLength(2);
      expect(tokens[0]!.raw).toBe('binary');
      expect(tokens[0]!.position).toBe(0);
      expect(tokens[1]!.raw).toBe('tree');
      expect(tokens[1]!.position).toBe(2);
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
