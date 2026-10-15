/**
 * Search Engine – high-level facade over the core primitives
 *
 * Combines: query parsing → ranking → phrase filtering → snippet generation
 * → typo tolerance ("did you mean").
 */
import { type BM25Options, type InvertedIndex, type Snippet } from './types.js';
import { type BigramIndex } from './typo.js';
import { tokenizeTerms } from './tokenizer.js';
export type RankerType = 'bm25' | 'tfidf';
export interface SearchOptions {
    ranker?: RankerType;
    page?: number;
    limit?: number;
    bm25?: BM25Options;
}
export interface SearchResultItem {
    docId: string;
    score: number;
    snippet: Snippet;
}
export interface SearchResult {
    total: number;
    results: SearchResultItem[];
    didYouMean: string | null;
}
/**
 * Execute a full search query against `index`.
 *
 * @param index    The inverted index.
 * @param rawQuery The raw user query string.
 * @param docTexts Map from docId → full text (needed for snippet generation).
 * @param bigramIdx Bigram index for typo correction.
 * @param opts     Ranker selection, pagination, BM25 params.
 */
export declare function search(index: InvertedIndex, rawQuery: string, docTexts: Map<string, string>, bigramIdx: BigramIndex, opts?: SearchOptions): SearchResult;
export { tokenizeTerms };
//# sourceMappingURL=search-engine.d.ts.map