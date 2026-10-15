/**
 * @seekr/core – public exports
 */
export type { Posting, DocMeta, InvertedIndex, RankedResult, QueryClause, Snippet, BM25Options, SearchHit, SearchResponse, StoredDocument, CrawlStatus, FeedEvent, MetricsResponse, } from './types.js';
export { tokenize, tokenizeTerms, stem, STOPWORDS } from './tokenizer.js';
export type { Token } from './tokenizer.js';
export { createIndex, addDocument, removeDocument, getPostings, df, termCount, } from './inverted-index.js';
export { MinHeap, TopKHeap } from './heap.js';
export { scoreBM25, scoreTFIDF } from './ranker.js';
export { parseQuery, extractTerms, phraseMatchesDoc } from './query-parser.js';
export { Trie } from './trie.js';
export { levenshtein, bigrams, buildBigramIndex, addTermToBigramIndex, findCandidates, didYouMean, } from './typo.js';
export type { TypoCandidate, BigramIndex } from './typo.js';
export { generateSnippet } from './snippet.js';
export { saveIndex, loadIndex, loadOrCreate } from './serializer.js';
export { search } from './search-engine.js';
export type { RankerType, SearchOptions, SearchResultItem, SearchResult, } from './search-engine.js';
//# sourceMappingURL=index.d.ts.map