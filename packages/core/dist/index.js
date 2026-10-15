/**
 * @seekr/core – public exports
 */
// Tokenizer
export { tokenize, tokenizeTerms, stem, STOPWORDS } from './tokenizer.js';
// Inverted index
export { createIndex, addDocument, removeDocument, getPostings, df, termCount, } from './inverted-index.js';
// Heap
export { MinHeap, TopKHeap } from './heap.js';
// Rankers
export { scoreBM25, scoreTFIDF } from './ranker.js';
// Query parser
export { parseQuery, extractTerms, phraseMatchesDoc } from './query-parser.js';
// Trie
export { Trie } from './trie.js';
// Typo tolerance
export { levenshtein, bigrams, buildBigramIndex, addTermToBigramIndex, findCandidates, didYouMean, } from './typo.js';
// Snippet
export { generateSnippet } from './snippet.js';
// Serialization
export { saveIndex, loadIndex, loadOrCreate } from './serializer.js';
// Search engine facade
export { search } from './search-engine.js';
//# sourceMappingURL=index.js.map