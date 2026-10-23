import type { BM25Options, InvertedIndex, QueryClause, Snippet, Posting } from './types.js';
import { parseQuery, extractTerms, phraseMatchesDoc } from './query-parser.js';
import { scoreBM25, scoreBM25F, scoreTFIDF } from './ranker.js';
import { df } from './inverted-index.js';
import { generateSnippet } from './snippet.js';
import { didYouMean, type BigramIndex } from './typo.js';

export type RankerType = 'bm25' | 'tfidf';
export interface SearchOptions {
  ranker?: RankerType;
  page?: number;
  limit?: number;
  bm25?: BM25Options;
  snippets?: boolean;
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

/** Evaluate the AST as sets before ranking. Phrase verification uses per-term
 * position maps, avoiding a posting-list scan for every candidate document. */
function matches(clause: QueryClause, fields: Array<Map<string, Posting[]>>): Set<string> {
  if (clause.type === 'term')
    return new Set(fields.flatMap((field) => (field.get(clause.value) ?? []).map((p) => p.docId)));
  if (clause.type === 'phrase') {
    const result = new Set<string>();
    for (const field of fields) {
      const maps = new Map(
        clause.tokens.map((term) => [
          term,
          new Map((field.get(term) ?? []).map((p) => [p.docId, p.positions])),
        ]),
      );
      const first = maps.get(clause.tokens[0] ?? '');
      for (const id of first?.keys() ?? []) {
        const positions = new Map(
          clause.tokens.map((term) => [term, maps.get(term)?.get(id) ?? []]),
        );
        if (phraseMatchesDoc(clause.tokens, positions, clause.offsets)) result.add(id);
      }
    }
    return result;
  }
  const children = clause.clauses.map((child) => matches(child, fields));
  if (clause.type === 'or') return new Set(children.flatMap((child) => [...child]));
  children.sort((a, b) => a.size - b.size);
  const result = children[0] ?? new Set<string>();
  for (const id of result) if (children.some((child) => !child.has(id))) result.delete(id);
  return result;
}

export function search(
  index: InvertedIndex,
  rawQuery: string,
  docTexts: Map<string, string>,
  bigramIdx: BigramIndex,
  opts: SearchOptions = {},
): SearchResult {
  const { ranker = 'bm25', page = 1, limit = 10, bm25 = {} } = opts;
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1)
    throw new Error('Invalid pagination');
  const clause = parseQuery(rawQuery);
  const terms = extractTerms(clause);
  const useTitle = ranker === 'bm25' && (bm25.titleWeight ?? 0) > 0;
  const candidates = matches(
    clause,
    useTitle ? [index.postings, index.titlePostings] : [index.postings],
  );
  const hits = new Map(
    terms.map((term) => [
      term,
      df(index, term) + (useTitle ? (index.titlePostings.get(term)?.length ?? 0) : 0),
    ]),
  );
  const suggestion = didYouMean(terms, hits, bigramIdx);
  const ranked =
    ranker === 'tfidf'
      ? scoreTFIDF(index, terms, page * limit, candidates)
      : (useTitle ? scoreBM25F : scoreBM25)(index, terms, page * limit, bm25, candidates);
  return {
    total: candidates.size,
    didYouMean: suggestion,
    results: ranked.slice((page - 1) * limit).map((r) => ({
      ...r,
      snippet:
        opts.snippets === false
          ? { text: '', highlights: [] }
          : generateSnippet(
              docTexts.get(r.docId) ?? index.docs.get(r.docId)?.text ?? '',
              rawQuery.replace(/"/g, '').split(/\s+/).filter(Boolean),
            ),
    })),
  };
}
export { tokenizeTerms } from './tokenizer.js';
