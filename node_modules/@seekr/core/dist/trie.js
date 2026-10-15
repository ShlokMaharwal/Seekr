/**
 * Trie for autocomplete
 *
 * Stores terms (indexed vocabulary words + popular past queries) with their
 * occurrence frequencies. The top-K suggestions for a given prefix are found
 * by DFS traversal of the subtree rooted at the prefix node.
 *
 * Node: each TrieNode holds a map of children keyed by character, an optional
 * frequency (> 0 only for complete words), and the full word string (to avoid
 * re-building it during traversal).
 *
 * Suggestion ranking: uses a min-heap of size K during DFS to avoid collecting
 * all suffixes before sorting.
 */
import { MinHeap } from './heap.js';
function makeNode() {
    return { children: new Map(), frequency: 0, word: '' };
}
export class Trie {
    root = makeNode();
    _size = 0;
    /** Number of distinct terms stored. */
    get size() {
        return this._size;
    }
    /**
     * Insert a term with the given frequency.
     * If the term already exists, the frequency is incremented.
     */
    insert(term, frequency = 1) {
        if (term.length === 0)
            return;
        let node = this.root;
        for (const ch of term) {
            let child = node.children.get(ch);
            if (child === undefined) {
                child = makeNode();
                node.children.set(ch, child);
            }
            node = child;
        }
        if (node.frequency === 0) {
            this._size++;
            node.word = term;
        }
        node.frequency += frequency;
    }
    /**
     * Increment the frequency of an existing term (e.g. when it appears in
     * a new document or a query is repeated). No-op if term is absent.
     */
    increment(term, delta = 1) {
        const node = this.findNode(term);
        if (node !== null && node.frequency > 0) {
            node.frequency += delta;
        }
    }
    /**
     * Return up to `limit` autocomplete suggestions for `prefix`, ranked by
     * frequency (highest first).
     *
     * Implementation: DFS the subtree under the prefix node, collect all terminal
     * nodes, then use a min-heap of size `limit` to find the top-K without
     * sorting the entire candidate list.
     */
    suggest(prefix, limit = 6) {
        const node = this.findNode(prefix);
        if (node === null)
            return [];
        // Min-heap: smallest frequency at root, so we evict low-frequency items
        const heap = new MinHeap((a, b) => a.freq < b.freq);
        this.dfs(node, heap, limit);
        // Drain ascending then reverse → descending by frequency
        return heap
            .drainAscending()
            .reverse()
            .map((e) => e.word);
    }
    /** Remove all entries (useful for tests). */
    clear() {
        this.root.children.clear();
        this._size = 0;
    }
    // ---------------------------------------------------------------------------
    // Serialization
    // ---------------------------------------------------------------------------
    toJSON() {
        const entries = [];
        this.collectAll(this.root, entries);
        return entries;
    }
    static fromJSON(entries) {
        const trie = new Trie();
        for (const { word, frequency } of entries) {
            trie.insert(word, frequency);
        }
        return trie;
    }
    // ---------------------------------------------------------------------------
    // Private
    // ---------------------------------------------------------------------------
    findNode(prefix) {
        let node = this.root;
        for (const ch of prefix) {
            const child = node.children.get(ch);
            if (child === undefined)
                return null;
            node = child;
        }
        return node;
    }
    dfs(node, heap, limit) {
        if (node.frequency > 0) {
            const entry = { word: node.word, freq: node.frequency };
            heap.push(entry);
            if (heap.size > limit)
                heap.pop();
        }
        for (const child of node.children.values()) {
            this.dfs(child, heap, limit);
        }
    }
    collectAll(node, out) {
        if (node.frequency > 0) {
            out.push({ word: node.word, frequency: node.frequency });
        }
        for (const child of node.children.values()) {
            this.collectAll(child, out);
        }
    }
}
//# sourceMappingURL=trie.js.map