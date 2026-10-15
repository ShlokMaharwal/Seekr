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
export class MinHeap {
    data = [];
    lt;
    constructor(lt) {
        this.lt = lt;
    }
    get size() {
        return this.data.length;
    }
    peek() {
        return this.data[0];
    }
    push(item) {
        this.data.push(item);
        this.bubbleUp(this.data.length - 1);
    }
    pop() {
        if (this.data.length === 0)
            return undefined;
        const top = this.data[0];
        const last = this.data.pop();
        if (this.data.length > 0) {
            this.data[0] = last;
            this.sinkDown(0);
        }
        return top;
    }
    /** Drain all elements in ascending order (min first). */
    drainAscending() {
        const result = [];
        while (this.data.length > 0) {
            result.push(this.pop());
        }
        return result;
    }
    bubbleUp(i) {
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (this.lt(this.data[i], this.data[parent])) {
                this.swap(i, parent);
                i = parent;
            }
            else
                break;
        }
    }
    sinkDown(i) {
        const n = this.data.length;
        while (true) {
            let smallest = i;
            const l = 2 * i + 1;
            const r = 2 * i + 2;
            if (l < n && this.lt(this.data[l], this.data[smallest]))
                smallest = l;
            if (r < n && this.lt(this.data[r], this.data[smallest]))
                smallest = r;
            if (smallest === i)
                break;
            this.swap(i, smallest);
            i = smallest;
        }
    }
    swap(a, b) {
        const tmp = this.data[a];
        this.data[a] = this.data[b];
        this.data[b] = tmp;
    }
}
/**
 * Maintain a fixed-size top-K max-heap by using a min-heap internally.
 * The min-heap keeps the *smallest* scored item at the root so we can
 * quickly evict it when a better candidate arrives.
 *
 * Complexity: O(n log K) insertions, O(K log K) final extraction.
 */
export class TopKHeap {
    k;
    heap;
    constructor(k, 
    /** Returns true if a's score is LESS than b's score. */
    scoreLt) {
        this.k = k;
        this.heap = new MinHeap(scoreLt);
    }
    push(item) {
        this.heap.push(item);
        if (this.heap.size > this.k) {
            // Evict the lowest-scored item
            this.heap.pop();
        }
    }
    /** Returns items sorted descending (highest score first). */
    results() {
        return this.heap.drainAscending().reverse();
    }
    get size() {
        return this.heap.size;
    }
}
//# sourceMappingURL=heap.js.map