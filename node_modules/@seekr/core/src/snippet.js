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
import { tokenizeTerms } from './tokenizer.js';
const DEFAULT_WINDOW_WORDS = 40;
const DEFAULT_WINDOW_CHARS = 300;
/**
 * Generate a snippet for a document given a set of query terms.
 *
 * @param text       Full document text.
 * @param queryRaw   Raw (unstemmed) query terms to highlight.
 * @param windowWords  Number of words to include in the snippet window.
 */
export function generateSnippet(text, queryRaw, windowWords = DEFAULT_WINDOW_WORDS) {
    // Normalize query terms for matching (stemmed)
    const stemmedQuery = new Set(tokenizeTerms(queryRaw.join(' ')));
    // Extract word offsets from text
    const words = extractWordOffsets(text);
    if (words.length === 0) {
        return { text: '', highlights: [] };
    }
    // Find best sliding window
    const windowStart = findBestWindow(words, stemmedQuery, windowWords);
    const windowEnd = Math.min(windowStart + windowWords, words.length);
    const firstWord = words[windowStart];
    const lastWord = words[windowEnd - 1];
    if (firstWord === undefined || lastWord === undefined) {
        return { text: text.slice(0, DEFAULT_WINDOW_CHARS), highlights: [] };
    }
    // Slice the text to form the snippet
    const snippetStart = firstWord.start;
    const snippetEnd = Math.min(lastWord.end, snippetStart + DEFAULT_WINDOW_CHARS);
    let snippetText = text.slice(snippetStart, snippetEnd);
    // Add ellipsis if not starting at the beginning
    if (snippetStart > 0)
        snippetText = '…' + snippetText;
    if (snippetEnd < text.length)
        snippetText = snippetText + '…';
    // Compute highlight offsets relative to snippet
    const prefixLen = snippetStart > 0 ? '…'.length : 0;
    const highlights = [];
    for (let i = windowStart; i < windowEnd; i++) {
        const w = words[i];
        if (w === undefined)
            continue;
        if (w.end > snippetEnd)
            break;
        const stemmed = tokenizeTerms(w.word);
        if (stemmed.length > 0 && stemmedQuery.has(stemmed[0])) {
            const relStart = w.start - snippetStart + prefixLen;
            const relEnd = Math.min(w.end - snippetStart + prefixLen, snippetText.length);
            highlights.push([relStart, relEnd]);
        }
    }
    return { text: snippetText, highlights };
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function extractWordOffsets(text) {
    const result = [];
    const regex = /\S+/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
        result.push({ word: match[0], start: match.index, end: match.index + match[0].length });
    }
    return result;
}
/**
 * Sliding-window search for the best excerpt.
 * Returns the start index (into `words`) of the best window.
 */
function findBestWindow(words, stemmedQuery, windowSize) {
    let bestStart = 0;
    let bestScore = 0;
    // Use a frequency map to track query terms in the current window
    const freq = new Map();
    let distinctHits = 0;
    function addWord(w) {
        const stemmed = tokenizeTerms(w.word)[0];
        if (stemmed === undefined || !stemmedQuery.has(stemmed))
            return;
        const count = (freq.get(stemmed) ?? 0) + 1;
        freq.set(stemmed, count);
        if (count === 1)
            distinctHits++;
    }
    function removeWord(w) {
        const stemmed = tokenizeTerms(w.word)[0];
        if (stemmed === undefined || !stemmedQuery.has(stemmed))
            return;
        const count = (freq.get(stemmed) ?? 1) - 1;
        freq.set(stemmed, count);
        if (count === 0)
            distinctHits--;
    }
    // Initialize window
    const end = Math.min(windowSize, words.length);
    for (let i = 0; i < end; i++) {
        addWord(words[i]);
    }
    bestScore = distinctHits;
    // Slide
    for (let i = windowSize; i < words.length; i++) {
        addWord(words[i]);
        removeWord(words[i - windowSize]);
        if (distinctHits > bestScore) {
            bestScore = distinctHits;
            bestStart = i - windowSize + 1;
        }
    }
    return bestStart;
}
//# sourceMappingURL=snippet.js.map