import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { InvertedIndex, Posting } from './types.js';
import { createIndex } from './inverted-index.js';
import { tokenize } from './tokenizer.js';

const MAGIC = Buffer.from('SEEKR2\n');
class Writer {
  private chunks: Buffer[] = [];
  uint(value: number): void {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid unsigned integer');
    const bytes: number[] = [];
    do { const byte = value % 128; value = Math.floor(value / 128); bytes.push(byte | (value ? 128 : 0)); } while (value);
    this.chunks.push(Buffer.from(bytes));
  }
  string(text: string): void { const buffer = Buffer.from(text, 'utf8'); this.uint(buffer.length); this.chunks.push(buffer); }
  finish(): Buffer { return Buffer.concat(this.chunks); }
}
class Reader {
  offset = 0;
  constructor(private data: Buffer) {}
  uint(): number {
    let value = 0; let multiplier = 1;
    for (let i = 0; i < 8; i++) {
      const byte = this.data[this.offset++];
      if (byte === undefined) throw new Error('Truncated snapshot');
      value += (byte & 127) * multiplier;
      if (!Number.isSafeInteger(value)) throw new Error('Integer overflow');
      if (!(byte & 128)) return value;
      multiplier *= 128;
    }
    throw new Error('Invalid varint');
  }
  string(): string {
    const length = this.uint(); const end = this.offset + length;
    if (end > this.data.length) throw new Error('Truncated string');
    const result = this.data.subarray(this.offset, end).toString('utf8'); this.offset = end; return result;
  }
}

/** Ordinals keep arbitrary external document IDs out of posting lists.
 * Sorted ordinal gaps and sorted position gaps are unsigned base-128 varints. */
export function encodeIndex(index: InvertedIndex): Buffer {
  const writer = new Writer(); const docs = [...index.docs.values()].sort((a, b) => a.docId.localeCompare(b.docId));
  const ordinals = new Map(docs.map((doc, i) => [doc.docId, i]));
  writer.uint(docs.length);
  for (const doc of docs) {
    writer.string(doc.docId); writer.string(doc.title); writer.string(doc.url); writer.string(doc.text ?? '');
    writer.uint(doc.length); writer.uint(doc.titleLength ?? 0);
  }
  for (const field of [index.postings, index.titlePostings]) {
    writer.uint(field.size);
    for (const [term, postings] of [...field].sort(([a], [b]) => a.localeCompare(b))) {
      writer.string(term); writer.uint(postings.length); let previousDoc = 0;
      const ordered = [...postings].sort((a, b) => (ordinals.get(a.docId) ?? 0) - (ordinals.get(b.docId) ?? 0));
      for (const p of ordered) {
        const ordinal = ordinals.get(p.docId); if (ordinal === undefined) throw new Error('Unknown posting document');
        writer.uint(ordinal - previousDoc); previousDoc = ordinal;
        writer.uint(p.positions.length); let previousPos = 0;
        for (const position of p.positions) { writer.uint(position - previousPos); previousPos = position; }
      }
    }
  }
  const payload = writer.finish();
  return Buffer.concat([MAGIC, createHash('sha256').update(payload).digest(), payload]);
}

export function decodeIndex(data: Buffer): InvertedIndex {
  if (!data.subarray(0, MAGIC.length).equals(MAGIC)) return decodeLegacy(data.toString('utf8'));
  const checksum = data.subarray(MAGIC.length, MAGIC.length + 32);
  const payload = data.subarray(MAGIC.length + 32);
  if (!checksum.equals(createHash('sha256').update(payload).digest())) throw new Error('Snapshot checksum mismatch');
  const reader = new Reader(payload); const index = createIndex(); const ids: string[] = [];
  const count = reader.uint(); if (count > payload.length) throw new Error('Invalid document count');
  for (let i = 0; i < count; i++) {
    const docId = reader.string(); const title = reader.string(); const url = reader.string(); const text = reader.string();
    const length = reader.uint(); const titleLength = reader.uint();
    if (index.docs.has(docId)) throw new Error('Duplicate document ID');
    index.docs.set(docId, { docId, title, url, text, length, titleLength }); ids.push(docId);
  }
  for (const field of [index.postings, index.titlePostings]) {
    const terms = reader.uint(); if (terms > payload.length) throw new Error('Invalid term count');
    for (let t = 0; t < terms; t++) {
      const term = reader.string(); const postings: Posting[] = []; let ordinal = 0;
      const postingCount = reader.uint(); if (postingCount > count) throw new Error('Invalid posting count');
      for (let p = 0; p < postingCount; p++) {
        ordinal += reader.uint(); const docId = ids[ordinal]; if (docId === undefined) throw new Error('Unknown document ordinal');
        const frequency = reader.uint(); if (!frequency || frequency > payload.length) throw new Error('Invalid frequency');
        const positions: number[] = []; let position = 0;
        for (let n = 0; n < frequency; n++) { position += reader.uint(); positions.push(position); }
        postings.push({ docId, tf: frequency, positions });
      }
      if (field.has(term)) throw new Error('Duplicate term'); field.set(term, postings);
    }
  }
  if (reader.offset !== payload.length) throw new Error('Trailing snapshot bytes');
  updateStats(index); return index;
}

function array(value: unknown): unknown[] { if (!Array.isArray(value)) throw new Error('Invalid legacy array'); return value; }
function string(value: unknown): string { if (typeof value !== 'string') throw new Error('Invalid legacy string'); return value; }
function uint(value: unknown): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Invalid legacy integer'); return value; }
function decodeLegacy(raw: string): InvertedIndex {
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 || !('docs' in data) || !('postings' in data)) throw new Error('Unsupported snapshot format');
  const index = createIndex();
  for (const value of array(data.docs)) {
    const row = array(value); const docId = string(row[0]); const title = string(row[2]);
    index.docs.set(docId, { docId, length: uint(row[1]), title, url: string(row[3]), titleLength: tokenize(title).length });
  }
  function readPostings(value: unknown, target: Map<string, Posting[]>): void {
    for (const entry of array(value)) {
      const row = array(entry); const term = string(row[0]); const postings: Posting[] = [];
      for (const value of array(row[1])) {
        const row = array(value); const docId = string(row[0]); let position = 0;
        const positions = array(row[2]).map(gap => { position += uint(gap); return position; });
        if (!index.docs.has(docId) || uint(row[1]) !== positions.length) throw new Error('Invalid legacy posting');
        postings.push({ docId, tf: positions.length, positions });
      }
      target.set(term, postings);
    }
  }
  readPostings(data.postings, index.postings);
  // Older JSON had only body postings. Reconstruct the title field from titles.
  for (const doc of index.docs.values()) {
    for (const token of tokenize(doc.title)) {
      const list = index.titlePostings.get(token.term) ?? [];
      let posting = list.find(p => p.docId === doc.docId);
      if (!posting) { posting = { docId: doc.docId, tf: 0, positions: [] }; list.push(posting); }
      posting.positions.push(token.position); posting.tf++; index.titlePostings.set(token.term, list);
    }
  }
  if ('texts' in data) for (const value of array(data.texts)) {
    const row = array(value); const doc = index.docs.get(string(row[0])); if (doc) doc.text = string(row[1]);
  }
  updateStats(index); return index;
}
function updateStats(index: InvertedIndex): void {
  index.N = index.docs.size;
  index.avgDocLen = [...index.docs.values()].reduce((sum, d) => sum + d.length, 0) / (index.N || 1);
  index.avgTitleLen = [...index.docs.values()].reduce((sum, d) => sum + (d.titleLength ?? 0), 0) / (index.N || 1);
}
/** Comparable JSON baseline includes the same snippet text and title field. */
export function encodeLegacyIndex(index: InvertedIndex): string {
  const encodePostings = (field: Map<string, Posting[]>) => [...field].map(([term, list]) => [term, list.map(p => {
    let previous = 0; return [p.docId, p.tf, p.positions.map(position => { const gap = position - previous; previous = position; return gap; })];
  })]);
  return JSON.stringify({ version: 1, N: index.N, avgDocLen: index.avgDocLen,
    docs: [...index.docs.values()].map(d => [d.docId, d.length, d.title, d.url]),
    texts: [...index.docs.values()].map(d => [d.docId, d.text ?? '']),
    postings: encodePostings(index.postings), titlePostings: encodePostings(index.titlePostings) });
}
export async function saveIndex(index: InvertedIndex, filePath: string): Promise<void> {
  const data = encodeIndex(index); const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true }); const temp = path.join(dir, `.${path.basename(filePath)}.${randomUUID()}.tmp`);
  try {
    const file = await fs.open(temp, 'wx');
    try { await file.writeFile(data); await file.sync(); } finally { await file.close(); }
    await fs.rename(temp, filePath);
  } catch (error) { await fs.unlink(temp).catch(() => {}); throw error; }
}
export async function loadIndex(filePath: string): Promise<InvertedIndex> { return decodeIndex(await fs.readFile(filePath)); }
export async function loadOrCreate(filePath: string): Promise<InvertedIndex> {
  try { return await loadIndex(filePath); } catch { return createIndex(); }
}
