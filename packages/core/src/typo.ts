// ---------------------------------------------------------------------------
// Damerau-Levenshtein distance (optimal string alignment variant)
// Supports insertion, deletion, substitution, and transposition of adjacent
// characters. O(m × n) time, O(2n) space using two-row DP.
//
// Transposition makes this more accurate for common typos like "teh" → "the",
// "recieve" → "receive", "adn" → "and".
// ---------------------------------------------------------------------------

/**
 * Compute the Damerau-Levenshtein edit distance between two strings.
 * Returns early if the distance exceeds `maxDist` (optimization).
 *
 * Operations: insert, delete, substitute, transpose adjacent characters.
 * Each operation costs 1.
 */
export function levenshtein(a: string, b: string, maxDist = Infinity): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;

  // Need two previous rows for transposition check
  let prevPrev = new Array<number>(b.length + 1);
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = i;

    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (prev[j] as number) + 1,     // deletion
        (curr[j - 1] as number) + 1, // insertion
        (prev[j - 1] as number) + cost, // substitution
      );

      // Transposition: swap of two adjacent characters
      // Only valid when i >= 2 and j >= 2 and a[i-1]==b[j-2] and a[i-2]==b[j-1]
      if (
        i > 1 && j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        curr[j] = Math.min(
          curr[j] as number,
          (prevPrev[j - 2] as number) + cost, // transposition
        );
      }

      if ((curr[j] as number) < rowMin) rowMin = curr[j] as number;
    }

    // Early termination: if the entire row exceeds maxDist, bail out
    if (rowMin > maxDist) return maxDist + 1;

    [prevPrev, prev, curr] = [prev, curr, prevPrev];
  }

  return prev[b.length] as number;
}


// ---------------------------------------------------------------------------
// Bigram index
// ---------------------------------------------------------------------------

/** Extract character bigrams from a string. "cat" → ["ca", "at"] */
export function bigrams(word: string): string[] {
  const result: string[] = [];
  for (let i = 0; i < word.length - 1; i++) {
    result.push(word.slice(i, i + 2));
  }
  return result;
}

/** Map from bigram → Set of vocabulary terms containing that bigram. */
export type BigramIndex = Map<string, Set<string>>;

/**
 * Build a bigram index from a vocabulary.
 * Call this once after the inverted index is fully built (or on each
 * incremental update with the delta terms).
 */
export function buildBigramIndex(vocabulary: Iterable<string>): BigramIndex {
  const index: BigramIndex = new Map();
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
export function addTermToBigramIndex(index: BigramIndex, term: string): void {
  for (const bg of bigrams(term)) {
    let s = index.get(bg);
    if (s === undefined) {
      s = new Set();
      index.set(bg, s);
    }
    s.add(term);
  }
}

// ---------------------------------------------------------------------------
// Candidate lookup
// ---------------------------------------------------------------------------

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
export function findCandidates(
  queryTerm: string,
  bigramIdx: BigramIndex,
  maxDist = 2,
): TypoCandidate[] {
  // Phase 1: bigram filter
  const termBigrams = bigrams(queryTerm);
  const candidateSet = new Set<string>();

  for (const bg of termBigrams) {
    const matches = bigramIdx.get(bg);
    if (matches !== undefined) {
      for (const t of matches) candidateSet.add(t);
    }
  }

  // Phase 2: Levenshtein verification
  const results: TypoCandidate[] = [];
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
export function didYouMean(
  queryTerms: string[],
  hitCounts: Map<string, number>,
  bigramIdx: BigramIndex,
  maxDist = 2,
): string | null {
  let changed = false;
  const corrected = queryTerms.map((term) => {
    const hits = hitCounts.get(term) ?? 0;
    if (hits > 0) return term;

    const candidates = findCandidates(term, bigramIdx, maxDist);
    if (candidates.length === 0) return term;
    changed = true;
    return (candidates[0] as TypoCandidate).term;
  });

  return changed ? corrected.join(' ') : null;
}
