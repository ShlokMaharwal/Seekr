/**
 * Index Serialization
 *
 * Saves and loads the InvertedIndex to/from disk in a compact JSON format
 * with delta-encoded positions to reduce file size.
 *
 * Delta encoding:
 *   Instead of storing positions as [5, 12, 20, 35], we store the first
 *   value absolute and subsequent values as deltas: [5, 7, 8, 15].
 *   This makes small, frequently-occurring position gaps compress well.
 *
 * Format (JSON):
 * {
 *   "version": 1,
 *   "N": <number>,
 *   "avgDocLen": <number>,
 *   "docs": [ [docId, length, title, url], ... ],
 *   "postings": [ [term, [ [docId, tf, deltaPositions], ... ] ], ... ]
 * }
 */

import fs from 'fs/promises';
import path from 'path';
import { type DocMeta, type InvertedIndex, type Posting } from './types.js';
import { createIndex } from './inverted-index.js';

const FORMAT_VERSION = 1;

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

type SerializedPosting = [docId: string, tf: number, deltaPositions: number[]];
type SerializedTerm = [term: string, postings: SerializedPosting[]];
type SerializedDoc = [docId: string, length: number, title: string, url: string];

interface SerializedIndex {
  version: number;
  N: number;
  avgDocLen: number;
  docs: SerializedDoc[];
  postings: SerializedTerm[];
}

function deltaEncode(positions: number[]): number[] {
  if (positions.length === 0) return [];
  const result: number[] = [positions[0] as number];
  for (let i = 1; i < positions.length; i++) {
    result.push((positions[i] as number) - (positions[i - 1] as number));
  }
  return result;
}

function deltaDecode(deltas: number[]): number[] {
  if (deltas.length === 0) return [];
  const result: number[] = [deltas[0] as number];
  for (let i = 1; i < deltas.length; i++) {
    result.push((result[i - 1] as number) + (deltas[i] as number));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

/**
 * Persist the inverted index to a JSON file at `filePath`.
 * Parent directories are created automatically.
 * Writes to a temporary file first and renames atomically to prevent corrupted files on crash.
 */
export async function saveIndex(
  index: InvertedIndex,
  filePath: string,
): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  const docs: SerializedDoc[] = [];
  for (const meta of index.docs.values()) {
    docs.push([meta.docId, meta.length, meta.title, meta.url]);
  }

  const postings: SerializedTerm[] = [];
  for (const [term, postingList] of index.postings) {
    const serializedPostings: SerializedPosting[] = postingList.map((p) => [
      p.docId,
      p.tf,
      deltaEncode(p.positions),
    ]);
    postings.push([term, serializedPostings]);
  }

  const data: SerializedIndex = {
    version: FORMAT_VERSION,
    N: index.N,
    avgDocLen: index.avgDocLen,
    docs,
    postings,
  };

  const tempPath = path.join(
    dir,
    `.${path.basename(filePath)}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`,
  );

  try {
    await fs.writeFile(tempPath, JSON.stringify(data), 'utf8');
    await fs.rename(tempPath, filePath);
  } catch (err) {
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore cleanup error if temp file does not exist
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

/**
 * Load an inverted index from a JSON file.
 * Throws if the file does not exist or the format version is incompatible.
 */
export async function loadIndex(filePath: string): Promise<InvertedIndex> {
  const raw = await fs.readFile(filePath, 'utf8');
  const data = JSON.parse(raw) as SerializedIndex;

  if (data.version !== FORMAT_VERSION) {
    throw new Error(
      `Unsupported index format version ${data.version} (expected ${FORMAT_VERSION})`,
    );
  }

  const index = createIndex();
  index.N = data.N;
  index.avgDocLen = data.avgDocLen;

  for (const [docId, length, title, url] of data.docs) {
    const meta: DocMeta = { docId, length, title, url };
    index.docs.set(docId, meta);
  }

  for (const [term, postingList] of data.postings) {
    const decoded: Posting[] = postingList.map(([docId, tf, deltas]) => ({
      docId,
      tf,
      positions: deltaDecode(deltas),
    }));
    index.postings.set(term, decoded);
  }

  return index;
}

/**
 * Load the index if the snapshot exists, otherwise return a fresh empty index.
 */
export async function loadOrCreate(filePath: string): Promise<InvertedIndex> {
  try {
    return await loadIndex(filePath);
  } catch {
    return createIndex();
  }
}
