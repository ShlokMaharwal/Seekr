/**
 * Snippet Generator
 *
 * Selects the best window of text (up to `windowChars` characters) that
 * contains the maximum number of distinct query terms, then returns the
 * excerpt with character-level highlight offsets.
 *
 * Algorithm:
 *   1. Split text into words with their byte offsets.
 *   2. Use a sliding window of `windowWords` words.
 *   3. Score each window by number of distinct query terms it contains.
 *   4. Pick the highest-scoring window (ties broken by earlier position).
 *   5. Within the chosen window, find all character ranges for query matches.
 *
 * The returned `highlights` array contains [start, end) pairs relative to
 * the beginning of the snippet string, suitable for `<mark>` insertion.
 */
import { type Snippet } from './types.js';
/**
 * Generate a snippet for a document given a set of query terms.
 *
 * @param text       Full document text.
 * @param queryRaw   Raw (unstemmed) query terms to highlight.
 * @param windowWords  Number of words to include in the snippet window.
 */
export declare function generateSnippet(text: string, queryRaw: string[], windowWords?: number): Snippet;
//# sourceMappingURL=snippet.d.ts.map