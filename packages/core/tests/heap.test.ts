import { describe, it, expect } from 'vitest';
import { MinHeap, TopKHeap } from '../src/heap.js';

describe('MinHeap', () => {
  it('pops elements in ascending order', () => {
    const heap = new MinHeap<number>((a, b) => a < b);
    heap.push(5);
    heap.push(1);
    heap.push(3);
    heap.push(2);
    heap.push(4);
    expect(heap.pop()).toBe(1);
    expect(heap.pop()).toBe(2);
    expect(heap.pop()).toBe(3);
  });

  it('size decreases on pop', () => {
    const heap = new MinHeap<number>((a, b) => a < b);
    heap.push(1);
    heap.push(2);
    expect(heap.size).toBe(2);
    heap.pop();
    expect(heap.size).toBe(1);
  });

  it('peek does not remove the element', () => {
    const heap = new MinHeap<number>((a, b) => a < b);
    heap.push(42);
    expect(heap.peek()).toBe(42);
    expect(heap.size).toBe(1);
  });

  it('drainAscending returns all in order', () => {
    const heap = new MinHeap<number>((a, b) => a < b);
    [3, 1, 4, 1, 5, 9, 2, 6].forEach((n) => heap.push(n));
    const sorted = heap.drainAscending();
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i - 1]).toBeLessThanOrEqual(sorted[i]!);
    }
  });

  it('returns undefined on pop from empty heap', () => {
    const heap = new MinHeap<number>((a, b) => a < b);
    expect(heap.pop()).toBeUndefined();
  });
});

describe('TopKHeap', () => {
  it('retains top K elements by score', () => {
    interface Item { id: number; score: number }
    const heap = new TopKHeap<Item>(3, (a, b) => a.score < b.score);
    for (let i = 1; i <= 10; i++) heap.push({ id: i, score: i });
    const results = heap.results();
    expect(results).toHaveLength(3);
    // Top 3 should be ids 10, 9, 8
    expect(results.map((r) => r.id)).toEqual([10, 9, 8]);
  });

  it('results are sorted descending', () => {
    const heap = new TopKHeap<number>(5, (a, b) => a < b);
    [3, 1, 4, 1, 5, 9, 2, 6].forEach((n) => heap.push(n));
    const results = heap.results();
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1]).toBeGreaterThanOrEqual(results[i]!);
    }
  });

  it('handles fewer items than K', () => {
    const heap = new TopKHeap<number>(10, (a, b) => a < b);
    heap.push(5);
    heap.push(3);
    const results = heap.results();
    expect(results).toHaveLength(2);
  });
});
