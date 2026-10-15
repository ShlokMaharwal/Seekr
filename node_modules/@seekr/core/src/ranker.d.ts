/**
 * Ranking algorithms: TF-IDF and BM25
 *
 * Both rankers operate on an InvertedIndex and a list of query terms, and
 * return top-K results using a min-heap (see heap.ts) to avoid a full sort.
 *
 * ---
 * TF-IDF scoring (per document d, term t):
 *   tf_weight  = 1 + log(tf(t,d))          if tf > 0, else 0
 *   idf_weight = log((N + 1) / (df(t) + 1)) + 1   (smoothed)
 *   score(d)   = Σ_t  tf_weight(t,d) × idf_weight(t)
 *
 * ---
 * BM25 scoring (Okapi BM25):
 *   idf(t) = log((N - df(t) + 0.5) / (df(t) + 0.5) + 1)
 *
 *   For each posting (docId, tf, |d|):
 *     tf_norm = tf × (k1 + 1)
 *               ─────────────────────────────────────
 *               tf + k1 × (1 - b + b × |d| / avgDocLen)
 *
 *   score(d) = Σ_t  idf(t) × tf_norm(t, d)
 *
 * Default k1 = 1.2, b = 0.75 (Robertson et al. recommended values).
 *
 * Why BM25 over TF-IDF?
 *   BM25 saturates TF growth (diminishing returns for repeated terms) and
 *   normalizes for document length, making it significantly more effective
 *   for web-scale corpora with variable-length documents.
 */
import { type BM25Options, type InvertedIndex, type RankedResult } from './types.js';
/**
 * Score all documents that contain at least one query term using TF-IDF.
 * Returns the top-K results sorted by score descending.
 */
export declare function scoreTFIDF(index: InvertedIndex, queryTerms: string[], k?: number): RankedResult[];
/**
 * Score all documents using Okapi BM25.
 * Returns the top-K results sorted by score descending.
 *
 * @param k1  Term saturation parameter (default 1.2).
 * @param b   Length normalization parameter (default 0.75).
 */
export declare function scoreBM25(index: InvertedIndex, queryTerms: string[], k?: number, { k1, b }?: BM25Options): RankedResult[];
//# sourceMappingURL=ranker.d.ts.map