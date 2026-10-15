import { describe, it, expect } from 'vitest';
import { Trie } from '../src/trie.js';

describe('Trie', () => {
  it('starts empty', () => {
    const trie = new Trie();
    expect(trie.size).toBe(0);
  });

  it('inserts a single term', () => {
    const trie = new Trie();
    trie.insert('hello');
    expect(trie.size).toBe(1);
  });

  it('returns suggestions for a matching prefix', () => {
    const trie = new Trie();
    trie.insert('hello', 10);
    trie.insert('help', 5);
    trie.insert('world', 20);
    const suggestions = trie.suggest('hel');
    expect(suggestions).toContain('hello');
    expect(suggestions).toContain('help');
    expect(suggestions).not.toContain('world');
  });

  it('ranks suggestions by frequency (highest first)', () => {
    const trie = new Trie();
    trie.insert('abc', 1);
    trie.insert('abd', 100);
    trie.insert('abe', 50);
    const suggestions = trie.suggest('ab');
    expect(suggestions[0]).toBe('abd');
    expect(suggestions[1]).toBe('abe');
    expect(suggestions[2]).toBe('abc');
  });

  it('respects the limit parameter', () => {
    const trie = new Trie();
    for (let i = 0; i < 20; i++) trie.insert(`term${i}`, i + 1);
    const suggestions = trie.suggest('term', 5);
    expect(suggestions.length).toBeLessThanOrEqual(5);
  });

  it('returns empty array for unknown prefix', () => {
    const trie = new Trie();
    trie.insert('hello');
    expect(trie.suggest('xyz')).toHaveLength(0);
  });

  it('exact match is included in suggestions', () => {
    const trie = new Trie();
    trie.insert('cat', 10);
    trie.insert('category', 5);
    const suggestions = trie.suggest('cat');
    expect(suggestions).toContain('cat');
  });

  it('increment updates frequency', () => {
    const trie = new Trie();
    trie.insert('alpha', 1);
    trie.insert('beta', 100);
    trie.increment('alpha', 200); // now alpha has 201
    const suggestions = trie.suggest('');
    // alpha should now outrank beta
    const alphaIdx = suggestions.indexOf('alpha');
    const betaIdx = suggestions.indexOf('beta');
    expect(alphaIdx).toBeLessThan(betaIdx);
  });

  it('serializes and deserializes correctly', () => {
    const trie = new Trie();
    trie.insert('hello', 10);
    trie.insert('world', 20);
    const json = trie.toJSON();
    const restored = Trie.fromJSON(json);
    expect(restored.suggest('he')).toContain('hello');
    expect(restored.suggest('wo')).toContain('world');
  });

  it('handles empty prefix (suggest all)', () => {
    const trie = new Trie();
    trie.insert('alpha', 5);
    trie.insert('beta', 10);
    const suggestions = trie.suggest('', 10);
    expect(suggestions).toContain('alpha');
    expect(suggestions).toContain('beta');
  });
});
