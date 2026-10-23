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

// ---------------------------------------------------------------------------
// Stopword list (top ~120 English stopwords)
// ---------------------------------------------------------------------------
const STOPWORDS = new Set([
  'a',
  'about',
  'above',
  'after',
  'again',
  'against',
  'all',
  'am',
  'an',
  'and',
  'any',
  'are',
  'aren',
  'as',
  'at',
  'be',
  'because',
  'been',
  'before',
  'being',
  'below',
  'between',
  'both',
  'but',
  'by',
  'can',
  'couldn',
  'd',
  'did',
  'didn',
  'do',
  'does',
  'doesn',
  'doing',
  'don',
  'down',
  'during',
  'each',
  'few',
  'for',
  'from',
  'further',
  'get',
  'got',
  'had',
  'hadn',
  'has',
  'hasn',
  'have',
  'haven',
  'having',
  'he',
  'her',
  'here',
  'hers',
  'herself',
  'him',
  'himself',
  'his',
  'how',
  'i',
  'if',
  'in',
  'into',
  'is',
  'isn',
  'it',
  'its',
  'itself',
  'just',
  'll',
  'm',
  'me',
  'more',
  'most',
  'mustn',
  'my',
  'myself',
  'no',
  'nor',
  'not',
  'now',
  'of',
  'off',
  'on',
  'once',
  'only',
  'or',
  'other',
  'our',
  'ours',
  'ourselves',
  'out',
  'over',
  'own',
  're',
  's',
  'same',
  'shan',
  'she',
  'should',
  'shouldn',
  'so',
  'some',
  'such',
  't',
  'than',
  'that',
  'the',
  'their',
  'theirs',
  'them',
  'themselves',
  'then',
  'there',
  'these',
  'they',
  'this',
  'those',
  'through',
  'to',
  'too',
  'under',
  'until',
  'up',
  'us',
  've',
  'very',
  'was',
  'wasn',
  'we',
  'were',
  'weren',
  'what',
  'when',
  'where',
  'which',
  'while',
  'who',
  'whom',
  'why',
  'will',
  'with',
  'won',
  'would',
  'wouldn',
  'y',
  'you',
  'your',
  'yours',
  'yourself',
  'yourselves',
]);

// ---------------------------------------------------------------------------
// Simplified Porter stemmer (suffix-stripping rules)
// ---------------------------------------------------------------------------

/**
 * Returns the number of "measures" (VC sequences) in a word stem.
 * This is the classic Porter measure m(w).
 */
function measure(word: string): number {
  // Replace vowel runs with 'v' and consonant runs with 'c', then count 'vc'
  const pattern = word.replace(/[aeiou]+/g, 'v').replace(/[^v]+/g, 'c');
  return (pattern.match(/vc/g) ?? []).length;
}

function endsIn(word: string, suffix: string): boolean {
  return word.endsWith(suffix);
}

function stemStep1a(word: string): string {
  if (endsIn(word, 'sses')) return word.slice(0, -2);
  if (endsIn(word, 'ies')) return word.slice(0, -2);
  if (endsIn(word, 'ss')) return word;
  if (endsIn(word, 's')) return word.slice(0, -1);
  return word;
}

function stemStep1b(word: string): string {
  if (endsIn(word, 'eed')) {
    const stem = word.slice(0, -3);
    return measure(stem) > 0 ? stem + 'ee' : word;
  }
  const edStem = endsIn(word, 'ed') ? word.slice(0, -2) : null;
  const ingStem = endsIn(word, 'ing') ? word.slice(0, -3) : null;
  const stem = edStem ?? ingStem;
  if (stem != null && /[aeiou]/.test(stem)) {
    // Step 1b(ii)
    if (endsIn(stem, 'at') || endsIn(stem, 'bl') || endsIn(stem, 'iz')) return stem + 'e';
    if (
      /([^aeiou])\1$/.test(stem) &&
      !endsIn(stem, 'll') &&
      !endsIn(stem, 'ss') &&
      !endsIn(stem, 'zz')
    )
      return stem.slice(0, -1);
    if (measure(stem) === 1 && /[^aeiou][aeiou][^aeiouywx]$/.test(stem)) return stem + 'e';
    return stem;
  }
  return word;
}

function stemStep1c(word: string): string {
  if (endsIn(word, 'y')) {
    const stem = word.slice(0, -1);
    if (/[aeiou]/.test(stem)) return stem + 'i';
  }
  return word;
}

function stemStep2(word: string): string {
  const rules: Array<[string, string]> = [
    ['ational', 'ate'],
    ['tional', 'tion'],
    ['enci', 'ence'],
    ['anci', 'ance'],
    ['izer', 'ize'],
    ['abli', 'able'],
    ['alli', 'al'],
    ['entli', 'ent'],
    ['eli', 'e'],
    ['ousli', 'ous'],
    ['ization', 'ize'],
    ['ation', 'ate'],
    ['ator', 'ate'],
    ['alism', 'al'],
    ['iveness', 'ive'],
    ['fulness', 'ful'],
    ['ousness', 'ous'],
    ['aliti', 'al'],
    ['iviti', 'ive'],
    ['biliti', 'ble'],
  ];
  for (const [suffix, replacement] of rules) {
    if (endsIn(word, suffix)) {
      const stem = word.slice(0, -suffix.length);
      if (measure(stem) > 0) return stem + replacement;
    }
  }
  return word;
}

function stemStep3(word: string): string {
  const rules: Array<[string, string]> = [
    ['icate', 'ic'],
    ['ative', ''],
    ['alize', 'al'],
    ['iciti', 'ic'],
    ['ical', 'ic'],
    ['ful', ''],
    ['ness', ''],
  ];
  for (const [suffix, replacement] of rules) {
    if (endsIn(word, suffix)) {
      const stem = word.slice(0, -suffix.length);
      if (measure(stem) > 0) return stem + replacement;
    }
  }
  return word;
}

function stemStep4(word: string): string {
  const suffixes = [
    'al',
    'ance',
    'ence',
    'er',
    'ic',
    'able',
    'ible',
    'ant',
    'ement',
    'ment',
    'ent',
    'ion',
    'ou',
    'ism',
    'ate',
    'iti',
    'ous',
    'ive',
    'ize',
  ];
  for (const suffix of suffixes) {
    if (endsIn(word, suffix)) {
      const stem = word.slice(0, -suffix.length);
      if (measure(stem) > 1) {
        // Extra rule for 'ion': stem must end in s or t
        if (suffix === 'ion' && !/[st]$/.test(stem)) continue;
        return stem;
      }
    }
  }
  return word;
}

function stemStep5a(word: string): string {
  if (endsIn(word, 'e')) {
    const stem = word.slice(0, -1);
    if (measure(stem) > 1) return stem;
    if (measure(stem) === 1 && !/[^aeiou][aeiou][^aeiouywx]$/.test(stem)) return stem;
  }
  return word;
}

function stemStep5b(word: string): string {
  if (measure(word) > 1 && /ll$/.test(word)) return word.slice(0, -1);
  return word;
}

/**
 * Apply the simplified Porter stemmer to a single word.
 * Words shorter than 3 characters are returned as-is.
 */
export function stem(word: string): string {
  if (word.length < 3) return word;
  let w = word;
  w = stemStep1a(w);
  w = stemStep1b(w);
  w = stemStep1c(w);
  w = stemStep2(w);
  w = stemStep3(w);
  w = stemStep4(w);
  w = stemStep5a(w);
  w = stemStep5b(w);
  return w;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface Token {
  /** Stemmed, normalized term. */
  term: string;
  /** Raw surface form before stemming. */
  raw: string;
  /** Zero-based position in the original word stream, including removed stopwords. */
  position: number;
}

/**
 * Tokenize `text` into a stream of `Token` objects.
 *
 * @param text        Raw document or query text.
 * @param stem_       Override the stemmer (useful for testing). Defaults to Porter.
 * @param removeStop  Whether to apply stopword removal (default true).
 */
export function tokenize(
  text: string,
  stemFn: (w: string) => string = stem,
  removeStop = true,
): Token[] {
  // Step 1: lowercase
  const lower = text.toLowerCase();
  // Step 2: split on whitespace and strip non-alphanumeric characters from each token
  const raw = lower.match(/[a-z0-9]+/g) ?? [];

  const tokens: Token[] = [];
  let position = 0;

  for (const word of raw) {
    if (word.length === 0) continue;
    // When stopwords are removed, we still increment position so relative token
    // distances accurately reflect original word positions in the text.
    // This ensures phrase queries like "binary the tree" vs "binary tree"
    // are distinguished properly by term positions.
    if (removeStop && STOPWORDS.has(word)) {
      position++;
      continue;
    }
    const term = stemFn(word);
    tokens.push({ term, raw: word, position });
    position++;
  }

  return tokens;
}

/**
 * Convenience helper: tokenize and return only the term strings.
 */
export function tokenizeTerms(text: string): string[] {
  return tokenize(text).map((t) => t.term);
}

export { STOPWORDS };
