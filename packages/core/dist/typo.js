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
// ---------------------------------------------------------------------------
// Levenshtein distance (standard DP, O(m × n) time, O(n) space)
// ---------------------------------------------------------------------------
/**
 * Compute the Levenshtein edit distance between two strings.
 * Returns early if the distance exceeds `maxDist` (optimization).
 */
export function levenshtein(a, b, maxDist = Infinity) {
    if (a === b)
        return 0;
    if (Math.abs(a.length - b.length) > maxDist)
        return maxDist + 1;
    // Use single-row DP; swap `prev` and `curr` each iteration
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    let curr = new Array(b.length + 1);
    for (let i = 1; i <= a.length; i++) {
        curr[0] = i;
        let rowMin = i;
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(prev[j] + 1, // deletion
            curr[j - 1] + 1, // insertion
            prev[j - 1] + cost);
            if (curr[j] < rowMin)
                rowMin = curr[j];
        }
        // Early termination: if the entire row exceeds maxDist, bail out
        if (rowMin > maxDist)
            return maxDist + 1;
        [prev, curr] = [curr, prev];
    }
    return prev[b.length];
}
// ---------------------------------------------------------------------------
// Bigram index
// ---------------------------------------------------------------------------
/** Extract character bigrams from a string. "cat" → ["ca", "at"] */
export function bigrams(word) {
    const result = [];
    for (let i = 0; i < word.length - 1; i++) {
        result.push(word.slice(i, i + 2));
    }
    return result;
}
/**
 * Build a bigram index from a vocabulary.
 * Call this once after the inverted index is fully built (or on each
 * incremental update with the delta terms).
 */
export function buildBigramIndex(vocabulary) {
    const index = new Map();
    for (const term of vocabulary) {
        for (const bg of bigrams(term)) {
            let s = index.get(bg);
            if (s === undefined) {
                s = new Set();
                index.set(bg, s);
            }
            s.add(term);
        }
    }
    return index;
}
/**
 * Add a single term to an existing bigram index (for incremental updates).
 */
export function addTermToBigramIndex(index, term) {
    for (const bg of bigrams(term)) {
        let s = index.get(bg);
        if (s === undefined) {
            s = new Set();
            index.set(bg, s);
        }
        s.add(term);
    }
}
/**
 * Find spelling correction candidates for `queryTerm`.
 *
 * @param queryTerm   The potentially misspelled term.
 * @param bigramIdx   Pre-built bigram index over the vocabulary.
 * @param maxDist     Maximum accepted Levenshtein distance (default 2).
 * @returns           Candidates sorted by (distance ASC, term ASC).
 */
export function findCandidates(queryTerm, bigramIdx, maxDist = 2) {
    // Phase 1: bigram filter
    const termBigrams = bigrams(queryTerm);
    const candidateSet = new Set();
    for (const bg of termBigrams) {
        const matches = bigramIdx.get(bg);
        if (matches !== undefined) {
            for (const t of matches)
                candidateSet.add(t);
        }
    }
    // Phase 2: Levenshtein verification
    const results = [];
    for (const candidate of candidateSet) {
        const dist = levenshtein(queryTerm, candidate, maxDist);
        if (dist <= maxDist && dist > 0) {
            results.push({ term: candidate, distance: dist });
        }
    }
    results.sort((a, b) => a.distance - b.distance || a.term.localeCompare(b.term));
    return results;
}
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
export function didYouMean(queryTerms, hitCounts, bigramIdx, maxDist = 2) {
    let changed = false;
    const corrected = queryTerms.map((term) => {
        const hits = hitCounts.get(term) ?? 0;
        if (hits > 0)
            return term;
        const candidates = findCandidates(term, bigramIdx, maxDist);
        if (candidates.length === 0)
            return term;
        changed = true;
        return candidates[0].term;
    });
    return changed ? corrected.join(' ') : null;
}
//# sourceMappingURL=typo.js.map