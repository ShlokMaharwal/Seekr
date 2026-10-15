/**
 * Tokenizer module
 *
 * Pipeline:
 *   1. Lowercase
 *   2. Strip punctuation / non-alpha-numeric characters
 *   3. Remove stopwords (English)
 *   4. Apply suffix-stripping stemmer (simplified Porter rules)
 *
 * Positional information is preserved: each token carries its zero-based
 * position index so the inverted index can support phrase queries.
 */
declare const STOPWORDS: Set<string>;
/**
 * Apply the simplified Porter stemmer to a single word.
 * Words shorter than 3 characters are returned as-is.
 */
export declare function stem(word: string): string;
export interface Token {
    /** Stemmed, normalized term. */
    term: string;
    /** Raw surface form before stemming. */
    raw: string;
    /** Zero-based position index in the token stream (after stopword removal). */
    position: number;
}
/**
 * Tokenize `text` into a stream of `Token` objects.
 *
 * @param text        Raw document or query text.
 * @param stem_       Override the stemmer (useful for testing). Defaults to Porter.
 * @param removeStop  Whether to apply stopword removal (default true).
 */
export declare function tokenize(text: string, stemFn?: (w: string) => string, removeStop?: boolean): Token[];
/**
 * Convenience helper: tokenize and return only the term strings.
 */
export declare function tokenizeTerms(text: string): string[];
export { STOPWORDS };
//# sourceMappingURL=tokenizer.d.ts.map