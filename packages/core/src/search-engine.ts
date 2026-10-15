/**
 * Search Engine – high-level facade over the core primitives
 *
 * Combines: query parsing → ranking → phrase filtering → snippet generation
 * → typo tolerance ("did you mean").
 */

import { type BM25Options, type InvertedIndex, type RankedResult, type Snippet } from './types.js';
import { parseQuery, extractTerms, phraseMatchesDoc } from './query-parser.js';
import { scoreBM25, scoreTFIDF } from './ranker.js';
import { getPostings, df } from './inverted-index.js';
import { generateSnippet } from './snippet.js';
import { didYouMean, type BigramIndex } from './typo.js';
import { tokenizeTerms } from './tokenizer.js';
import type { QueryClause } from './types.js';


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
export function search(
  index: InvertedIndex,
  rawQuery: string,
  docTexts: Map<string, string>,
  bigramIdx: BigramIndex,
  opts: SearchOptions = {},
): SearchResult {
  const {
    ranker = 'bm25',
    page = 1,
    limit = 10,
    bm25: bm25Opts = {},
  } = opts;

  const clause = parseQuery(rawQuery);
  const queryTerms = extractTerms(clause);

  // Collect hit counts for typo detection
  const hitCounts = new Map<string, number>();
  for (const term of queryTerms) {
    hitCounts.set(term, df(index, term));
  }

  // "Did you mean?" runs BEFORE we decide on an empty result set
  const suggestion = didYouMean(queryTerms, hitCounts, bigramIdx);

  // Ranking (top K = page * limit, we'll paginate after)
  const topK = page * limit;
  const ranked: RankedResult[] =
    ranker === 'bm25'
      ? scoreBM25(index, queryTerms, topK, bm25Opts)
      : scoreTFIDF(index, queryTerms, topK);

  // Phrase filter: for phrase clauses, verify positional adjacency
  const filteredRanked = ranked.filter((r) => {
    return satisfiesPhrase(clause, r.docId, index);
  });

  const total = filteredRanked.length;
  const pageSlice = filteredRanked.slice((page - 1) * limit, page * limit);

  const results: SearchResultItem[] = pageSlice.map((r) => {
    const text = docTexts.get(r.docId) ?? '';
    const rawTerms = rawQuery
      .replace(/"/g, '')
      .split(/\s+/)
      .filter(Boolean);
    return {
      docId: r.docId,
      score: r.score,
      snippet: generateSnippet(text, rawTerms),
    };
  });

  return { total, results, didYouMean: suggestion };
}

// ---------------------------------------------------------------------------
// Phrase clause verifier
// ---------------------------------------------------------------------------

function satisfiesPhrase(
  clause: QueryClause,
  docId: string,
  index: InvertedIndex,
): boolean {
  switch (clause.type) {
    case 'term':
      return true; // already filtered by ranker
    case 'phrase': {
      // Build position map for this doc using positional postings
      const docPositions = new Map<string, number[]>();
      for (const term of clause.tokens) {
        const postings = getPostings(index, term);
        const posting = postings.find((p) => p.docId === docId);
        if (posting) docPositions.set(term, posting.positions);
      }
      return phraseMatchesDoc(clause.tokens, docPositions);
    }
    case 'and':
      return clause.clauses.every((c) => satisfiesPhrase(c, docId, index));
    case 'or':
      return clause.clauses.some((c) => satisfiesPhrase(c, docId, index));
  }
}

// Re-export tokenizer helper for convenience
export { tokenizeTerms };
