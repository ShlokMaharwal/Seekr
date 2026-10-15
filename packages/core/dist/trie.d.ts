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
export declare class Trie {
    private readonly root;
    private _size;
    /** Number of distinct terms stored. */
    get size(): number;
    /**
     * Insert a term with the given frequency.
     * If the term already exists, the frequency is incremented.
     */
    insert(term: string, frequency?: number): void;
    /**
     * Increment the frequency of an existing term (e.g. when it appears in
     * a new document or a query is repeated). No-op if term is absent.
     */
    increment(term: string, delta?: number): void;
    /**
     * Return up to `limit` autocomplete suggestions for `prefix`, ranked by
     * frequency (highest first).
     *
     * Implementation: DFS the subtree under the prefix node, collect all terminal
     * nodes, then use a min-heap of size `limit` to find the top-K without
     * sorting the entire candidate list.
     */
    suggest(prefix: string, limit?: number): string[];
    /** Remove all entries (useful for tests). */
    clear(): void;
    toJSON(): Array<{
        word: string;
        frequency: number;
    }>;
    static fromJSON(entries: Array<{
        word: string;
        frequency: number;
    }>): Trie;
    private findNode;
    private dfs;
    private collectAll;
}
//# sourceMappingURL=trie.d.ts.map