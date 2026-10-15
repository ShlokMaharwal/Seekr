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
export declare class MinHeap<T> {
    private readonly data;
    private readonly lt;
    constructor(lt: (a: T, b: T) => boolean);
    get size(): number;
    peek(): T | undefined;
    push(item: T): void;
    pop(): T | undefined;
    /** Drain all elements in ascending order (min first). */
    drainAscending(): T[];
    private bubbleUp;
    private sinkDown;
    private swap;
}
/**
 * Maintain a fixed-size top-K max-heap by using a min-heap internally.
 * The min-heap keeps the *smallest* scored item at the root so we can
 * quickly evict it when a better candidate arrives.
 *
 * Complexity: O(n log K) insertions, O(K log K) final extraction.
 */
export declare class TopKHeap<T> {
    private readonly k;
    private readonly heap;
    constructor(k: number, 
    /** Returns true if a's score is LESS than b's score. */
    scoreLt: (a: T, b: T) => boolean);
    push(item: T): void;
    /** Returns items sorted descending (highest score first). */
    results(): T[];
    get size(): number;
}
//# sourceMappingURL=heap.d.ts.map