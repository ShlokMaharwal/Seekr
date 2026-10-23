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
import { getPostings, df } from './inverted-index.js';
import { TopKHeap } from './heap.js';

// ---------------------------------------------------------------------------
// TF-IDF
// ---------------------------------------------------------------------------

/**
 * Score all documents that contain at least one query term using TF-IDF.
 * Returns the top-K results sorted by score descending.
 */
export function scoreTFIDF(
  index: InvertedIndex,
  queryTerms: string[],
  k = 10,
  allowed?: ReadonlySet<string>,
): RankedResult[] {
  const { N } = index;
  // Accumulate scores per docId
  const scores = new Map<string, number>();

  for (const term of queryTerms) {
    const docFreq = df(index, term);
    if (docFreq === 0) continue;

    // Smoothed IDF: log((N+1)/(df+1)) + 1
    const idf = Math.log((N + 1) / (docFreq + 1)) + 1;

    for (const { docId, tf } of getPostings(index, term)) {
      if (allowed && !allowed.has(docId)) continue;
      // Sublinear TF scaling: 1 + log(tf)
      const tfWeight = tf > 0 ? 1 + Math.log(tf) : 0;
      scores.set(docId, (scores.get(docId) ?? 0) + tfWeight * idf);
    }
  }

  return collectTopK(scores, k);
}

// ---------------------------------------------------------------------------
// BM25
// ---------------------------------------------------------------------------

/**
 * Score all documents using Okapi BM25.
 * Returns the top-K results sorted by score descending.
 *
 * @param k1  Term saturation parameter (default 1.2).
 * @param b   Length normalization parameter (default 0.75).
 */
export function scoreBM25(
  index: InvertedIndex,
  queryTerms: string[],
  k = 10,
  { k1 = 1.2, b = 0.75 }: BM25Options = {},
  allowed?: ReadonlySet<string>,
): RankedResult[] {
  const { N, avgDocLen, docs } = index;
  const scores = new Map<string, number>();

  for (const term of queryTerms) {
    const docFreq = df(index, term);
    if (docFreq === 0) continue;

    // BM25 IDF with "+1" smoothing to avoid negative values when df > N/2
    const idf = Math.log((N - docFreq + 0.5) / (docFreq + 0.5) + 1);

    for (const { docId, tf } of getPostings(index, term)) {
      if (allowed && !allowed.has(docId)) continue;
      const docLen = docs.get(docId)?.length ?? avgDocLen;
      // Guard against division by zero if corpus has 0 tokens or documents
      const safeAvgDocLen = avgDocLen > 0 ? avgDocLen : 1;

      // Length-normalized TF saturation (Robertson et al.):
      // - (1 - b + b * (|d| / avgdl)) modulates how heavily document length penalizes the score.
      // - When |d| == avgdl, the length multiplier is exactly 1.
      // - Higher k1 increases the score boost from multiple occurrences before reaching saturation.
      const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLen / safeAvgDocLen)));

      scores.set(docId, (scores.get(docId) ?? 0) + idf * tfNorm);
    }
  }

  return collectTopK(scores, k);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** BM25F normalizes each field, combines weighted frequencies, and saturates
 * once. Independent field saturation would double-count term evidence. */
export function scoreBM25F(
  index: InvertedIndex,
  queryTerms: string[],
  k = 10,
  { k1 = 1.2, b = 0.75, titleWeight = 2 }: BM25Options = {},
  allowed?: ReadonlySet<string>,
): RankedResult[] {
  const scores = new Map<string, number>();
  for (const term of queryTerms) {
    const byId = new Map(getPostings(index, term).map((p) => [p.docId, p.tf]));
    const titleById = new Map((index.titlePostings.get(term) ?? []).map((p) => [p.docId, p.tf]));
    const ids = new Set([...byId.keys(), ...(titleWeight > 0 ? titleById.keys() : [])]);
    const idf = Math.log(1 + (index.N - ids.size + 0.5) / (ids.size + 0.5));
    for (const id of ids) {
      if (allowed && !allowed.has(id)) continue;
      const doc = index.docs.get(id);
      if (!doc) continue;
      const bodyNorm = 1 - b + (b * doc.length) / (index.avgDocLen || 1);
      const titleNorm = 1 - b + (b * (doc.titleLength ?? 0)) / (index.avgTitleLen || 1);
      const tf =
        (byId.get(id) ?? 0) / (bodyNorm || 1) +
        (titleWeight * (titleById.get(id) ?? 0)) / (titleNorm || 1);
      scores.set(id, (scores.get(id) ?? 0) + (idf * tf * (k1 + 1)) / (k1 + tf));
    }
  }
  return collectTopK(scores, k);
}

/** Use a top-K min-heap to avoid sorting all scored documents. */
function collectTopK(scores: Map<string, number>, k: number): RankedResult[] {
  const heap = new TopKHeap<RankedResult>(
    k,
    (a, b) => a.score < b.score, // min-heap by score
  );

  for (const [docId, score] of scores) {
    heap.push({ docId, score });
  }

  return heap.results();
}
