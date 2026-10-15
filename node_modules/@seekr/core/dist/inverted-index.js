/**
 * Positional Inverted Index
 *
 * Structure:
 *   term → Posting[]   where Posting = { docId, tf, positions }
 *   docId → DocMeta    { docId, length, title, url }
 *
 * Positions are token-stream indices (after stopword removal) so phrase
 * queries can verify adjacency by checking position[i+1] == position[i] + 1.
 *
 * Corpus-level stats (N, avgDocLen) are updated incrementally on each add/remove.
 */
import { tokenize } from './tokenizer.js';
// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createIndex() {
    return {
        postings: new Map(),
        docs: new Map(),
        N: 0,
        avgDocLen: 0,
    };
}
// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------
/**
 * Add or update a document in the index.
 * If the docId already exists, the old postings are removed first (incremental update).
 */
export function addDocument(index, docId, text, title, url) {
    // Remove any existing version of this document
    if (index.docs.has(docId)) {
        removeDocument(index, docId);
    }
    const tokens = tokenize(text);
    const length = tokens.length;
    // Accumulate term → positions
    const termMap = new Map();
    for (const { term, position } of tokens) {
        let pos = termMap.get(term);
        if (pos === undefined) {
            pos = [];
            termMap.set(term, pos);
        }
        pos.push(position);
    }
    // Write postings
    for (const [term, positions] of termMap) {
        let list = index.postings.get(term);
        if (list === undefined) {
            list = [];
            index.postings.set(term, list);
        }
        list.push({ docId, tf: positions.length, positions });
    }
    // Store doc metadata
    index.docs.set(docId, { docId, length, title, url });
    // Update corpus stats
    const prevTotal = index.N * index.avgDocLen;
    index.N += 1;
    index.avgDocLen = (prevTotal + length) / index.N;
}
/**
 * Remove a document from the index.
 * Cleans up empty posting lists to keep memory lean.
 */
export function removeDocument(index, docId) {
    const meta = index.docs.get(docId);
    if (meta === undefined)
        return;
    const prevTotal = index.N * index.avgDocLen;
    index.N -= 1;
    index.avgDocLen = index.N > 0 ? (prevTotal - meta.length) / index.N : 0;
    index.docs.delete(docId);
    // Remove postings for this docId
    for (const [term, list] of index.postings) {
        const filtered = list.filter((p) => p.docId !== docId);
        if (filtered.length === 0) {
            index.postings.delete(term);
        }
        else {
            index.postings.set(term, filtered);
        }
    }
}
// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------
/** Return all posting entries for a term, or empty array. */
export function getPostings(index, term) {
    return index.postings.get(term) ?? [];
}
/** Document frequency: number of documents containing `term`. */
export function df(index, term) {
    return getPostings(index, term).length;
}
/** Total number of unique terms. */
export function termCount(index) {
    return index.postings.size;
}
//# sourceMappingURL=inverted-index.js.map