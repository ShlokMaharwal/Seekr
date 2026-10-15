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
import { tokenize } from './tokenizer.js';

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse a raw user query string into a QueryClause AST.
 */
export function parseQuery(raw: string): QueryClause {
  const segments = splitIntoSegments(raw.trim());

  if (segments.length === 0) {
    return { type: 'and', clauses: [] };
  }

  // Check for top-level OR (split on literal " OR ")
  const orParts = splitOnOR(segments);

  if (orParts.length > 1) {
    const clauses = orParts.map((part) => buildAndClause(part));
    return { type: 'or', clauses };
  }

  return buildAndClause(segments);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Segments are either a quoted phrase string or a single word token.
 * e.g. `foo "quick brown" bar` → ['foo', '"quick brown"', 'bar']
 */
function splitIntoSegments(raw: string): string[] {
  const segments: string[] = [];
  const regex = /"[^"]*"|[^\s]+/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    if (match[0].length > 0) segments.push(match[0]);
  }
  return segments;
}

/**
 * Split a segment list on the literal token "OR".
 * Returns sub-lists of segments (one per OR operand).
 */
function splitOnOR(segments: string[]): string[][] {
  const parts: string[][] = [];
  let current: string[] = [];
  for (const seg of segments) {
    if (seg.toUpperCase() === 'OR') {
      if (current.length > 0) parts.push(current);
      current = [];
    } else {
      current.push(seg);
    }
  }
  if (current.length > 0) parts.push(current);
  return parts;
}

/**
 * Build an AND clause from a list of segments.
 * Each segment is either a quoted phrase or a stemmed term.
 */
function buildAndClause(segments: string[]): QueryClause {
  const clauses: QueryClause[] = segments
    .map(segmentToClause)
    .filter((c): c is QueryClause => c !== null);

  if (clauses.length === 0) return { type: 'and', clauses: [] };
  if (clauses.length === 1) return clauses[0] as QueryClause;
  return { type: 'and', clauses };
}

function segmentToClause(segment: string): QueryClause | null {
  if (segment.startsWith('"') && segment.endsWith('"')) {
    // Phrase query
    const inner = segment.slice(1, -1);
    // Tokenize phrase terms WITHOUT stopword removal so positions stay intact
    const tokens = tokenize(inner, undefined, false);
    if (tokens.length === 0) return null;
    if (tokens.length === 1) return { type: 'term', value: tokens[0]!.term };
    return { type: 'phrase', tokens: tokens.map((t) => t.term) };
  }

  // Plain term
  const tokens = tokenize(segment);
  if (tokens.length === 0) return null;
  return { type: 'term', value: tokens[0]!.term };
}

// ---------------------------------------------------------------------------
// Clause → term extractor (for ranking)
// ---------------------------------------------------------------------------

/**
 * Flatten a QueryClause into a deduplicated list of terms.
 * Used to feed the rankers which operate at the term level.
 */
export function extractTerms(clause: QueryClause): string[] {
  const terms = new Set<string>();

  function walk(c: QueryClause): void {
    switch (c.type) {
      case 'term':
        terms.add(c.value);
        break;
      case 'phrase':
        for (const t of c.tokens) terms.add(t);
        break;
      case 'and':
      case 'or':
        for (const child of c.clauses) walk(child);
        break;
    }
  }

  walk(clause);
  return [...terms];
}

// ---------------------------------------------------------------------------
// Phrase-match verifier
// ---------------------------------------------------------------------------

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
export function phraseMatchesDoc(
  phraseStemmed: string[],
  /** Map from term → positions for a single document */
  docPositions: Map<string, number[]>,
): boolean {
  if (phraseStemmed.length === 0) return false;

  const firstTerm = phraseStemmed[0];
  if (firstTerm === undefined) return false;
  const firstPositions = docPositions.get(firstTerm);
  if (firstPositions === undefined || firstPositions.length === 0) return false;

  // Build position sets for fast lookup
  const posSets = phraseStemmed.map((t) => new Set(docPositions.get(t) ?? []));

  outer: for (const startPos of firstPositions) {
    for (let i = 1; i < phraseStemmed.length; i++) {
      if (!(posSets[i] as Set<number>).has(startPos + i)) {
        continue outer;
      }
    }
    return true;
  }
  return false;
}
