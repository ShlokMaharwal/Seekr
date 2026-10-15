/**
 * Min-Heap
 *
 * A generic binary min-heap used by the rankers to maintain a top-K list
 * without a full sort (O(n log K) instead of O(n log n)).
 *
 * The comparator `lt(a, b)` should return true if `a` has lower priority
 * than `b` (i.e., `a` should be closer to the root in a min-heap,
 * meaning it will be evicted first when the heap exceeds capacity K).
 */
export class MinHeap<T> {
  private readonly data: T[] = [];
  private readonly lt: (a: T, b: T) => boolean;

  constructor(lt: (a: T, b: T) => boolean) {
    this.lt = lt;
  }

  get size(): number {
    return this.data.length;
  }

  peek(): T | undefined {
    return this.data[0];
  }

  push(item: T): void {
    this.data.push(item);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0] as T;
    const last = this.data.pop() as T;
    if (this.data.length > 0) {
      (this.data as T[])[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  /** Drain all elements in ascending order (min first). */
  drainAscending(): T[] {
    const result: T[] = [];
    while (this.data.length > 0) {
      result.push(this.pop() as T);
    }
    return result;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.lt(this.data[i] as T, this.data[parent] as T)) {
        this.swap(i, parent);
        i = parent;
      } else break;
    }
  }

  private sinkDown(i: number): void {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && this.lt(this.data[l] as T, this.data[smallest] as T)) smallest = l;
      if (r < n && this.lt(this.data[r] as T, this.data[smallest] as T)) smallest = r;
      if (smallest === i) break;
      this.swap(i, smallest);
      i = smallest;
    }
  }

  private swap(a: number, b: number): void {
    const tmp = this.data[a] as T;
    (this.data as T[])[a] = this.data[b] as T;
    (this.data as T[])[b] = tmp;
  }
}

/**
 * Maintain a fixed-size top-K max-heap by using a min-heap internally.
 * The min-heap keeps the *smallest* scored item at the root so we can
 * quickly evict it when a better candidate arrives.
 *
 * Complexity: O(n log K) insertions, O(K log K) final extraction.
 */
export class TopKHeap<T> {
  private readonly heap: MinHeap<T>;

  constructor(
    private readonly k: number,
    /** Returns true if a's score is LESS than b's score. */
    scoreLt: (a: T, b: T) => boolean,
  ) {
    this.heap = new MinHeap(scoreLt);
  }

  push(item: T): void {
    this.heap.push(item);
    if (this.heap.size > this.k) {
      // Evict the lowest-scored item
      this.heap.pop();
    }
  }

  /** Returns items sorted descending (highest score first). */
  results(): T[] {
    return this.heap.drainAscending().reverse();
  }

  get size(): number {
    return this.heap.size;
  }
}
