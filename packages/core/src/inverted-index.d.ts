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
import { type InvertedIndex, type Posting } from './types.js';
export declare function createIndex(): InvertedIndex;
/**
 * Add or update a document in the index.
 * If the docId already exists, the old postings are removed first (incremental update).
 */
export declare function addDocument(index: InvertedIndex, docId: string, text: string, title: string, url: string): void;
/**
 * Remove a document from the index.
 * Cleans up empty posting lists to keep memory lean.
 */
export declare function removeDocument(index: InvertedIndex, docId: string): void;
/** Return all posting entries for a term, or empty array. */
export declare function getPostings(index: InvertedIndex, term: string): Posting[];
/** Document frequency: number of documents containing `term`. */
export declare function df(index: InvertedIndex, term: string): number;
/** Total number of unique terms. */
export declare function termCount(index: InvertedIndex): number;
//# sourceMappingURL=inverted-index.d.ts.map