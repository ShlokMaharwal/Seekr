/**
 * Index Manager
 *
 * Holds the in-memory InvertedIndex and BigramIndex as singletons.
 * Consumed by the search API routes and updated by the indexer.
 *
 * Lifecycle:
 *   1. On startup, load the index snapshot from disk (if available).
 *   2. Consume the Redis stream "stream:new-docs" for new documents, adding
 *      them incrementally to the in-memory index.
 *   3. Periodically persist the index snapshot to disk.
 *
 * Persistence strategy:
 *   - Snapshot is saved every SNAPSHOT_INTERVAL_MS (default 60s).
 *   - On graceful shutdown, a final snapshot is written.
 *   - The snapshot file path is configurable via INDEX_SNAPSHOT_PATH env var.
 */
import { Redis } from 'ioredis';
import { type InvertedIndex, type BigramIndex, Trie } from '@seekr/core';
export declare class IndexManager {
    index: InvertedIndex;
    bigramIndex: BigramIndex;
    readonly trie: Trie;
    /** docId → full text (for snippet generation) */
    readonly docTexts: Map<string, string>;
    private readonly snapshotPath;
    private readonly redis;
    private snapshotTimer;
    private running;
    constructor(redis: Redis);
    load(): Promise<void>;
    startIndexer(): Promise<void>;
    stop(): Promise<void>;
    private consumeLoop;
    /**
     * Incrementally add one document to the index.
     * Updates postings, bigram index, and trie.
     */
    indexDocument(id: string, text: string, title: string, url: string): void;
    /** Record a query in the trie for autocomplete boosting. */
    recordQuery(queryTerms: string[]): void;
    saveSnapshot(): Promise<void>;
    /** Approximate size of the serialized index in MB. */
    estimateSizeMb(): number;
}
//# sourceMappingURL=index-manager.d.ts.map