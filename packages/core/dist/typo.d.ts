/**
 * Typo Tolerance
 *
 * Two-phase approach:
 *
 * Phase 1 – Candidate generation via bigram index:
 *   Build an inverted index from character bigrams to vocabulary terms.
 *   For a misspelled query term, extract its bigrams and look up all vocab
 *   terms that share at least one bigram. This is a fast approximate filter
 *   that narrows the search space from |vocabulary| to a small candidate set.
 *
 *   Bigrams of "seach": { se, ea, ac, ch } → candidate terms that share any
 *   of these bigrams, e.g. "search", "teach", "reach".
 *
 * Phase 2 – Levenshtein verification:
 *   For each candidate, compute the true edit distance with the full DP
 *   algorithm. Accept candidates with distance ≤ maxDist (default 2).
 *   Among accepted candidates, rank by (edit distance ASC, frequency DESC).
 *
 * Why bigrams first?
 *   Computing Levenshtein for every vocabulary term would be O(|V| × L²) per
 *   query. Bigram pre-filtering reduces this to O(candidates × L²) where
 *   candidates ≪ |V|.
 */
/**
 * Compute the Levenshtein edit distance between two strings.
 * Returns early if the distance exceeds `maxDist` (optimization).
 */
export declare function levenshtein(a: string, b: string, maxDist?: number): number;
/** Extract character bigrams from a string. "cat" → ["ca", "at"] */
export declare function bigrams(word: string): string[];
/** Map from bigram → Set of vocabulary terms containing that bigram. */
export type BigramIndex = Map<string, Set<string>>;
/**
 * Build a bigram index from a vocabulary.
 * Call this once after the inverted index is fully built (or on each
 * incremental update with the delta terms).
 */
export declare function buildBigramIndex(vocabulary: Iterable<string>): BigramIndex;
/**
 * Add a single term to an existing bigram index (for incremental updates).
 */
export declare function addTermToBigramIndex(index: BigramIndex, term: string): void;
export interface TypoCandidate {
    term: string;
    distance: number;
}
/**
 * Find spelling correction candidates for `queryTerm`.
 *
 * @param queryTerm   The potentially misspelled term.
 * @param bigramIdx   Pre-built bigram index over the vocabulary.
 * @param maxDist     Maximum accepted Levenshtein distance (default 2).
 * @returns           Candidates sorted by (distance ASC, term ASC).
 */
export declare function findCandidates(queryTerm: string, bigramIdx: BigramIndex, maxDist?: number): TypoCandidate[];
/**
 * Build a "did you mean" suggestion for a full query string.
 *
 * For each term in the query that has zero hits in the index, find the closest
 * vocabulary term and substitute it. If no substitution is needed, returns null.
 *
 * @param queryTerms   Stemmed terms from the parsed query.
 * @param hitCounts    Map from term → number of documents containing it.
 * @param bigramIdx    Pre-built bigram index.
 * @param maxDist      Max edit distance for suggestions.
 */
export declare function didYouMean(queryTerms: string[], hitCounts: Map<string, number>, bigramIdx: BigramIndex, maxDist?: number): string | null;
//# sourceMappingURL=typo.d.ts.map