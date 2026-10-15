/**
 * Query Parser
 *
 * Grammar (simplified):
 *   query   := clause (WS clause)*
 *   clause  := OR_clause | AND_clause
 *   AND_clause := atom (WS atom)*           -- implicit AND
 *   OR_clause  := atom WS 'OR' WS atom
 *   atom    := '"' phrase '"' | term
 *   phrase  := term (WS term)+
 *   term    := [a-z0-9]+
 *
 * Examples:
 *   "hello world"           => phrase query
 *   foo bar                 => AND(foo, bar)
 *   foo OR bar              => OR(foo, bar)
 *   "quick brown" fox       => AND(phrase(quick,brown), fox)
 *
 * All terms are stemmed with the same pipeline used during indexing so
 * that term matching is consistent.
 */
import { type QueryClause } from './types.js';
/**
 * Parse a raw user query string into a QueryClause AST.
 */
export declare function parseQuery(raw: string): QueryClause;
/**
 * Flatten a QueryClause into a deduplicated list of terms.
 * Used to feed the rankers which operate at the term level.
 */
export declare function extractTerms(clause: QueryClause): string[];
/**
 * Verify that a document's posting lists contain the phrase's terms
 * in consecutive positions.
 *
 * Algorithm:
 *   For the first phrase token, collect all positions in the document.
 *   For each candidate start position p, check that position p+i exists
 *   in the posting for phrase token i (for i=1,2,...).
 *
 * This uses the positional information stored in each Posting, making it
 * O(|positions|) per document rather than scanning the full text.
 */
export declare function phraseMatchesDoc(phraseStemmed: string[], 
/** Map from term → positions for a single document */
docPositions: Map<string, number[]>): boolean;
//# sourceMappingURL=query-parser.d.ts.map