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
import { createIndex, addDocument, buildBigramIndex, addTermToBigramIndex, loadOrCreate, saveIndex, termCount, Trie, } from '@seekr/core';
import { logger } from './logger.js';
const INDEXER_STREAM = 'stream:new-docs';
const SNAPSHOT_INTERVAL_MS = 60_000; // 60 seconds
const CONSUMER_GROUP = 'indexer-group';
const CONSUMER_NAME = `indexer-${process.pid}`;
export class IndexManager {
    index = createIndex();
    bigramIndex = new Map();
    trie = new Trie();
    /** docId → full text (for snippet generation) */
    docTexts = new Map();
    snapshotPath;
    redis;
    snapshotTimer = null;
    running = false;
    constructor(redis) {
        this.redis = redis;
        this.snapshotPath = process.env['INDEX_SNAPSHOT_PATH'] ?? './data/index.json';
    }
    async load() {
        logger.info({ path: this.snapshotPath }, 'Loading index snapshot');
        this.index = await loadOrCreate(this.snapshotPath);
        this.bigramIndex = buildBigramIndex(this.index.postings.keys());
        // Rebuild trie from vocabulary
        for (const term of this.index.postings.keys()) {
            const posting = this.index.postings.get(term);
            const freq = posting?.reduce((s, p) => s + p.tf, 0) ?? 1;
            this.trie.insert(term, freq);
        }
        logger.info({ terms: termCount(this.index), docs: this.index.N }, 'Index loaded');
    }
    async startIndexer() {
        this.running = true;
        // Ensure consumer group exists
        try {
            await this.redis.xgroup('CREATE', INDEXER_STREAM, CONSUMER_GROUP, '0', 'MKSTREAM');
        }
        catch {
            // Group already exists — ok
        }
        // Periodic snapshot
        this.snapshotTimer = setInterval(() => {
            this.saveSnapshot().catch((err) => logger.error(err, 'Snapshot failed'));
        }, SNAPSHOT_INTERVAL_MS);
        // Start consuming
        this.consumeLoop().catch((err) => logger.error(err, 'Indexer loop failed'));
        logger.info('Indexer consumer started');
    }
    async stop() {
        this.running = false;
        if (this.snapshotTimer)
            clearInterval(this.snapshotTimer);
        await this.saveSnapshot();
    }
    async consumeLoop() {
        while (this.running) {
            try {
                // Read up to 20 messages, block for 1 second if stream is empty
                const results = await this.redis.xreadgroup('GROUP', CONSUMER_GROUP, CONSUMER_NAME, 'COUNT', '20', 'BLOCK', '1000', 'STREAMS', INDEXER_STREAM, '>');
                if (!results)
                    continue;
                for (const [, messages] of results) {
                    for (const [msgId, fields] of messages) {
                        const doc = parseStreamMessage(fields);
                        if (doc) {
                            this.indexDocument(doc.id, doc.text, doc.title, doc.url);
                            // Acknowledge the message
                            await this.redis.xack(INDEXER_STREAM, CONSUMER_GROUP, msgId);
                        }
                    }
                }
            }
            catch (err) {
                logger.warn(err, 'Indexer consume error, retrying');
                await sleep(1000);
            }
        }
    }
    /**
     * Incrementally add one document to the index.
     * Updates postings, bigram index, and trie.
     */
    indexDocument(id, text, title, url) {
        // Track new terms before adding so we can add them to bigram index
        const termsBefore = new Set(this.index.postings.keys());
        addDocument(this.index, id, text, title, url);
        this.docTexts.set(id, text);
        // Update bigram index and trie with any new terms
        for (const term of this.index.postings.keys()) {
            if (!termsBefore.has(term)) {
                addTermToBigramIndex(this.bigramIndex, term);
                this.trie.insert(term, 1);
            }
            else {
                this.trie.increment(term, 1);
            }
        }
    }
    /** Record a query in the trie for autocomplete boosting. */
    recordQuery(queryTerms) {
        for (const term of queryTerms) {
            this.trie.increment(term, 3); // queries count more than index terms
        }
    }
    async saveSnapshot() {
        try {
            await saveIndex(this.index, this.snapshotPath);
            logger.info({ path: this.snapshotPath, terms: termCount(this.index) }, 'Index snapshot saved');
        }
        catch (err) {
            logger.error(err, 'Failed to save index snapshot');
        }
    }
    /** Approximate size of the serialized index in MB. */
    estimateSizeMb() {
        const termsBytes = termCount(this.index) * 20; // rough estimate per term
        const postingsBytes = this.index.N * 50;
        return Math.round((termsBytes + postingsBytes) / 1024 / 1024 * 10) / 10;
    }
}
function parseStreamMessage(fields) {
    // Redis XREAD returns fields as a flat [key, value, key, value...] array
    const map = {};
    for (let i = 0; i < fields.length - 1; i += 2) {
        map[fields[i]] = fields[i + 1];
    }
    if (!map['id'] || !map['url'] || !map['text'])
        return null;
    return {
        id: map['id'],
        url: map['url'],
        title: map['title'] ?? '',
        text: map['text'],
        crawledAt: map['crawledAt'] ?? new Date().toISOString(),
        wordCount: parseInt(map['wordCount'] ?? '0', 10),
    };
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=index-manager.js.map