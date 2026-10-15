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
import { type InvertedIndex } from './types.js';
/**
 * Persist the inverted index to a JSON file at `filePath`.
 * Parent directories are created automatically.
 */
export declare function saveIndex(index: InvertedIndex, filePath: string): Promise<void>;
/**
 * Load an inverted index from a JSON file.
 * Throws if the file does not exist or the format version is incompatible.
 */
export declare function loadIndex(filePath: string): Promise<InvertedIndex>;
/**
 * Load the index if the snapshot exists, otherwise return a fresh empty index.
 */
export declare function loadOrCreate(filePath: string): Promise<InvertedIndex>;
//# sourceMappingURL=serializer.d.ts.map