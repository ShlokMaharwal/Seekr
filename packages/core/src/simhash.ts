import { createHash } from 'node:crypto';
import { tokenizeTerms } from './tokenizer.js';

/** Frequency-weighted 64-bit SimHash: similar token distributions share most
 * bits; fingerprints are order-independent, unlike exact content hashes. */
export function simHash(text: string): string {
  const weights = new Array<number>(64).fill(0);
  for (const term of tokenizeTerms(text)) {
    const value = createHash('sha256').update(term).digest().readBigUInt64BE();
    for (let bit = 0; bit < 64; bit++) weights[bit] = (weights[bit] ?? 0) + ((value >> BigInt(bit)) & 1n ? 1 : -1);
  }
  let hash = 0n;
  weights.forEach((weight, bit) => { if (weight > 0) hash |= 1n << BigInt(bit); });
  return hash.toString(16).padStart(16, '0');
}
export function hammingDistance(a: string, b: string): number {
  if (!/^[0-9a-f]{16}$/i.test(a) || !/^[0-9a-f]{16}$/i.test(b)) throw new Error('Expected 64-bit hexadecimal fingerprints');
  let bits = BigInt(`0x${a}`) ^ BigInt(`0x${b}`); let distance = 0;
  while (bits) { bits &= bits - 1n; distance++; }
  return distance;
}
/** For a threshold <=3, at least one 16-bit band must match, so MongoDB can
 * select a bounded candidate set through an index rather than scan all docs. */
export function simHashBands(hash: string): string[] {
  return [0, 1, 2, 3].map(i => `${i}:${hash.slice(i * 4, i * 4 + 4)}`);
}
