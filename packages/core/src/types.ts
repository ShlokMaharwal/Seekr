/**
 * Shared types used across all Seekr packages.
 */

/** A single term posting: which document contains the term and where. */
export interface Posting {
  docId: string;
  /** Raw term frequency in the document. */
  tf: number;
  /** Byte/token positions of each occurrence (for phrase search). */
  positions: number[];
}

/** Per-document metadata stored in the index. */
export interface DocMeta {
  docId: string;
  /** Total number of tokens in the document (used for BM25 length normalization). */
  length: number;
  title: string;
  url: string;
}

/** The full inverted index data structure. */
export interface InvertedIndex {
  /** term → postings list */
  postings: Map<string, Posting[]>;
  /** docId → metadata */
  docs: Map<string, DocMeta>;
  /** Total number of documents in the corpus. */
  N: number;
  /** Average document length (tokens) across the corpus. */
  avgDocLen: number;
}

/** A ranked search result. */
export interface RankedResult {
  docId: string;
  score: number;
}

/** A parsed query node – supports AND, OR, and phrase clauses. */
export type QueryClause =
  | { type: 'term'; value: string }
  | { type: 'phrase'; tokens: string[]; offsets?: number[] }
  | { type: 'and'; clauses: QueryClause[] }
  | { type: 'or'; clauses: QueryClause[] };

/** A generated snippet with highlighted positions. */
export interface Snippet {
  text: string;
  /** Character offsets [start, end) of matched terms inside `text`. */
  highlights: Array<[number, number]>;
}

/** Options controlling BM25 parameters. */
export interface BM25Options {
  k1?: number;
  b?: number;
}

/** A single search hit returned by the API. */
export interface SearchHit {
  id: string;
  title: string;
  url: string;
  snippet: string;
  score: number;
}

/** Full search API response. */
export interface SearchResponse {
  total: number;
  tookMs: number;
  didYouMean?: string | undefined;
  results: SearchHit[];
}

/** Document as stored in MongoDB. */
export interface StoredDocument {
  id: string;
  url: string;
  title: string;
  text: string;
  crawledAt: string;
  wordCount: number;
  contentHash: string;
}

/** Crawl status snapshot. */
export interface CrawlStatus {
  docs: number;
  terms: number;
  indexSizeMb: number;
  pagesPerMin: number;
  queueSize: number;
  duplicates: number;
  failures: number;
}

/** A single crawl feed event. */
export interface FeedEvent {
  url: string;
  status: 'success' | 'failed' | 'duplicate' | 'skipped';
  ts: string;
}

/** Metrics response. */
export interface MetricsResponse {
  latency: Array<{ ts: string; p50: number; p99: number }>;
  crawlRate: Array<{ ts: string; count: number }>;
  topQueries: Array<{ q: string; count: number }>;
}
