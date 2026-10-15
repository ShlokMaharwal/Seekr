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
import { createIndex } from './inverted-index.js';
const FORMAT_VERSION = 1;
function deltaEncode(positions) {
    if (positions.length === 0)
        return [];
    const result = [positions[0]];
    for (let i = 1; i < positions.length; i++) {
        result.push(positions[i] - positions[i - 1]);
    }
    return result;
}
function deltaDecode(deltas) {
    if (deltas.length === 0)
        return [];
    const result = [deltas[0]];
    for (let i = 1; i < deltas.length; i++) {
        result.push(result[i - 1] + deltas[i]);
    }
    return result;
}
// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------
/**
 * Persist the inverted index to a JSON file at `filePath`.
 * Parent directories are created automatically.
 */
export async function saveIndex(index, filePath) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const docs = [];
    for (const meta of index.docs.values()) {
        docs.push([meta.docId, meta.length, meta.title, meta.url]);
    }
    const postings = [];
    for (const [term, postingList] of index.postings) {
        const serializedPostings = postingList.map((p) => [
            p.docId,
            p.tf,
            deltaEncode(p.positions),
        ]);
        postings.push([term, serializedPostings]);
    }
    const data = {
        version: FORMAT_VERSION,
        N: index.N,
        avgDocLen: index.avgDocLen,
        docs,
        postings,
    };
    await fs.writeFile(filePath, JSON.stringify(data), 'utf8');
}
// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------
/**
 * Load an inverted index from a JSON file.
 * Throws if the file does not exist or the format version is incompatible.
 */
export async function loadIndex(filePath) {
    const raw = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(raw);
    if (data.version !== FORMAT_VERSION) {
        throw new Error(`Unsupported index format version ${data.version} (expected ${FORMAT_VERSION})`);
    }
    const index = createIndex();
    index.N = data.N;
    index.avgDocLen = data.avgDocLen;
    for (const [docId, length, title, url] of data.docs) {
        const meta = { docId, length, title, url };
        index.docs.set(docId, meta);
    }
    for (const [term, postingList] of data.postings) {
        const decoded = postingList.map(([docId, tf, deltas]) => ({
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
export async function loadOrCreate(filePath) {
    try {
        return await loadIndex(filePath);
    }
    catch {
        return createIndex();
    }
}
//# sourceMappingURL=serializer.js.map