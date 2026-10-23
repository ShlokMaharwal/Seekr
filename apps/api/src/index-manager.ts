/**
 * Index Manager
 *
 * Holds the in-memory InvertedIndex and BigramIndex as singletons.
 * Consumed by the search API routes and updated by the indexer.
 *
 * Lifecycle:
 *   1. On startup, load the index snapshot from disk (if available).
 *   2. If snapshot is missing or empty, rebuild the index from MongoDB by streaming.
 *   3. Consume the Redis stream "stream:new-docs" for new documents, adding
 *      them incrementally and idempotently to the in-memory index.
 *   4. Periodically persist the index snapshot to disk atomically.
 */

import { Redis } from 'ioredis';
import { z } from 'zod';
import {
  type InvertedIndex,
  type BigramIndex,
  createIndex,
  addDocument,
  removeDocument,
  buildBigramIndex,
  addTermToBigramIndex,
  loadIndex,
  saveIndex,
  termCount,
  Trie,
  tokenizeTerms,
} from '@seekr/core';
import { logger } from './logger.js';
import type { DocumentStore } from './store.js';

const INDEXER_STREAM = 'stream:new-docs';
const SNAPSHOT_INTERVAL_MS = 60_000; // 60 seconds
const CONSUMER_GROUP = 'indexer-group';
const CONSUMER_NAME = `indexer-${process.pid}`;
const StreamMessages = z.array(z.tuple([z.string(), z.array(z.string())]));
const StreamRead = z.array(z.tuple([z.string(), StreamMessages])).nullable();
const StreamClaim = z.tuple([z.string(), StreamMessages]).rest(z.unknown());

export class IndexManager {
  index: InvertedIndex = createIndex();
  bigramIndex: BigramIndex = new Map();
  readonly trie: Trie = new Trie();
  /** docId → full text (for snippet generation) */
  readonly docTexts: Map<string, string> = new Map();

  private readonly snapshotPath: string;
  private readonly redis: Redis;
  private readonly store?: DocumentStore | undefined;
  private snapshotTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(redis: Redis, store?: DocumentStore, snapshotPath?: string) {
    this.redis = redis;
    this.store = store;
    this.snapshotPath = snapshotPath ?? process.env['INDEX_SNAPSHOT_PATH'] ?? './data/index.bin';
  }

  /**
   * Load index from snapshot or rebuild from MongoDB if snapshot is missing/empty/corrupted.
   */
  async load(overrideStore?: DocumentStore): Promise<void> {
    const docStore = overrideStore ?? this.store;
    logger.info({ path: this.snapshotPath }, 'Loading index snapshot');

    try {
      this.index = await loadIndex(this.snapshotPath).catch(async (err: unknown) => {
        if (this.snapshotPath.endsWith('.bin') && err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
          return loadIndex(this.snapshotPath.replace(/\.bin$/, '.json'));
        }
        throw err;
      });
      logger.info({ terms: termCount(this.index), docs: this.index.N }, 'Index snapshot loaded successfully');
    } catch (err) {
      logger.warn({ err, path: this.snapshotPath }, 'Snapshot missing, partial, or corrupted; starting with empty index');
      this.index = createIndex();
    }

    // Index recovery: If snapshot is missing or empty, rebuild from MongoDB
    if (this.index.N === 0 && docStore) {
      logger.info('Index snapshot is missing or empty. Rebuilding index from MongoDB...');
      await this.rebuildFromStore(docStore);
    } else {
      this.rebuildAuxiliaryStructures();
      // Reconcile acknowledged documents newer than the last snapshot and
      // restore snippet text. The Mongo cursor bounds transient memory.
      if (docStore) {
        const present = new Set<string>();
        for await (const doc of docStore.stream()) {
          present.add(doc.id);
          const existing = this.index.docs.get(doc.id);
          if (existing?.text !== doc.text || existing.title !== doc.title || existing.url !== doc.url) {
            this.indexDocument(doc.id, doc.text, doc.title, doc.url);
          } else this.docTexts.set(doc.id, doc.text);
        }
        let removed = false;
        for (const id of this.index.docs.keys()) if (!present.has(id)) {
          removeDocument(this.index, id); this.docTexts.delete(id); removed = true;
        }
        if (removed) this.rebuildAuxiliaryStructures();
      }
    }

    logger.info({ terms: termCount(this.index), docs: this.index.N }, 'Index ready');
  }

  /**
   * Rebuild the full index from MongoDB documents by streaming them in batches.
   */
  async rebuildFromStore(store: DocumentStore): Promise<void> {
    logger.info('Starting streaming rebuild from MongoDB');
    let count = 0;
    const startTime = Date.now();

    for await (const doc of store.stream()) {
      this.indexDocument(doc.id, doc.text, doc.title, doc.url);
      count++;
      if (count % 500 === 0) {
        logger.info({ indexed: count }, 'Rebuilding index from MongoDB in progress...');
      }
    }

    const elapsed = Date.now() - startTime;
    logger.info({ totalDocs: count, terms: termCount(this.index), tookMs: elapsed }, 'MongoDB index rebuild complete');

    if (count > 0) {
      await this.saveSnapshot();
    }
  }

  /**
   * Reconstruct BigramIndex and Trie from existing InvertedIndex postings.
   */
  private rebuildAuxiliaryStructures(): void {
    for (const doc of this.index.docs.values()) if (doc.text !== undefined) this.docTexts.set(doc.docId, doc.text);
    const vocabulary = new Set([...this.index.postings.keys(), ...this.index.titlePostings.keys()]);
    this.bigramIndex = buildBigramIndex(vocabulary);
    this.trie.clear();
    for (const term of vocabulary) {
      const posting = this.index.postings.get(term);
      const freq = posting?.reduce((s: number, p: { tf: number }) => s + p.tf, 0) ?? 1;
      this.trie.insert(term, freq);
    }
  }

  async startIndexer(): Promise<void> {
    this.running = true;

    // Ensure consumer group exists
    try {
      await this.redis.xgroup('CREATE', INDEXER_STREAM, CONSUMER_GROUP, '0', 'MKSTREAM');
    } catch {
      // Group already exists — ok
    }

    // Recover pending unacknowledged messages left by crashed consumers
    await this.recoverPendingMessages();

    // Periodic snapshot
    this.snapshotTimer = setInterval(() => {
      this.saveSnapshot().catch((err) => logger.error(err, 'Snapshot failed'));
    }, SNAPSHOT_INTERVAL_MS);

    // Start consuming
    this.consumeLoop().catch((err) => logger.error(err, 'Indexer loop failed'));
    logger.info('Indexer consumer started');
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.snapshotTimer) clearInterval(this.snapshotTimer);
    await this.saveSnapshot();
  }

  /**
   * Recover pending messages left by a previous crashed consumer or pending in the PEL.
   */
  async recoverPendingMessages(): Promise<void> {
    try {
      // 1. Process pending messages assigned to this consumer
      const pendingResults = StreamRead.parse(await this.redis.xreadgroup(
        'GROUP',
        CONSUMER_GROUP,
        CONSUMER_NAME,
        'COUNT',
        '100',
        'STREAMS',
        INDEXER_STREAM,
        '0',
      ));

      if (pendingResults) {
        for (const [, messages] of pendingResults) {
          for (const [msgId, fields] of messages) {
            await this.processStreamMessage(msgId, fields);
          }
        }
      }

      // 2. Claim pending messages from other consumers idle for > 30s using XAUTOCLAIM
      try {
        let cursor = '0-0';
        do {
        const claimResult = StreamClaim.parse(await this.redis.xautoclaim(
          INDEXER_STREAM,
          CONSUMER_GROUP,
          CONSUMER_NAME,
          30000,
          cursor,
          'COUNT',
          100,
        ));
        cursor = claimResult[0];

        if (claimResult && claimResult[1] && claimResult[1].length > 0) {
          logger.info({ count: claimResult[1].length }, 'Claimed abandoned pending messages via XAUTOCLAIM');
          for (const [msgId, fields] of claimResult[1]) {
            await this.processStreamMessage(msgId, fields);
          }
        }
        } while (cursor !== '0-0');
      } catch (err) {
        logger.debug({ err }, 'XAUTOCLAIM not supported or completed with error');
      }
    } catch (err) {
      logger.warn({ err }, 'Error recovering pending messages at startup');
    }
  }

  private async consumeLoop(): Promise<void> {
    let nextRecovery = Date.now() + 30_000;
    while (this.running) {
      try {
        if (Date.now() >= nextRecovery) {
          await this.recoverPendingMessages();
          nextRecovery = Date.now() + 30_000;
        }
        // Read up to 20 messages, block for 1 second if stream is empty
        const results = StreamRead.parse(await this.redis.xreadgroup(
          'GROUP',
          CONSUMER_GROUP,
          CONSUMER_NAME,
          'COUNT',
          '20',
          'BLOCK',
          '1000',
          'STREAMS',
          INDEXER_STREAM,
          '>',
        ));

        if (!results) continue;

        for (const [, messages] of results) {
          for (const [msgId, fields] of messages) {
            await this.processStreamMessage(msgId, fields);
          }
        }
      } catch (err) {
        logger.warn(err, 'Indexer consume error, retrying');
        await sleep(1000);
      }
    }
  }

  /**
   * Process a single stream message with dead-letter queue (DLQ) support for poison messages.
   */
  async processStreamMessage(msgId: string, fields: string[]): Promise<void> {
    const doc = parseStreamMessage(fields);
    if (doc) {
      this.indexDocument(doc.id, doc.text, doc.title, doc.url);
      await this.redis.xack(INDEXER_STREAM, CONSUMER_GROUP, msgId);
    } else {
      // Poison message: fails to parse. Move to dead-letter stream, log, and acknowledge
      logger.warn({ msgId, fields }, 'Poison message in stream: failed to parse, moving to DLQ and acknowledging');
      try {
        await this.redis.xadd(
          `${INDEXER_STREAM}:dlq`,
          '*',
          'originalMsgId',
          msgId,
          'error',
          'parse_failure',
          'payload',
          JSON.stringify(fields),
          'ts',
          new Date().toISOString(),
        );
      } catch (dlqErr) {
        logger.error({ dlqErr, msgId }, 'Failed to record poison message in dead-letter stream');
      }
      await this.redis.xack(INDEXER_STREAM, CONSUMER_GROUP, msgId);
    }
  }

  /**
   * Incrementally and idempotently add or replace one document in the index.
   * Updates postings, bigram index, and trie without duplicates.
   */
  indexDocument(id: string, text: string, title: string, url: string): void {
    const current = this.index.docs.get(id);
    if (current?.text === text && current.title === title && current.url === url) { this.docTexts.set(id, text); return; }
    const isUpdate = this.index.docs.has(id);
    // addDocument atomically removes old postings first if id exists
    addDocument(this.index, id, text, title, url);
    this.docTexts.set(id, text);

    // Update bigram index and trie
    if (isUpdate) {
      this.rebuildAuxiliaryStructures();
    } else {
      const frequencies = new Map<string, number>();
      for (const term of tokenizeTerms(`${title} ${text}`)) frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
      for (const [term, frequency] of frequencies) {
        addTermToBigramIndex(this.bigramIndex, term);
        this.trie.insert(term, frequency);
      }
    }
  }

  /** Record a query in the trie for autocomplete boosting. */
  recordQuery(queryTerms: string[]): void {
    for (const term of queryTerms) {
      this.trie.increment(term, 3); // queries count more than index terms
    }
  }

  async saveSnapshot(): Promise<void> {
    try {
      await saveIndex(this.index, this.snapshotPath);
      logger.info({ path: this.snapshotPath, terms: termCount(this.index) }, 'Index snapshot saved');
    } catch (err) {
      logger.error(err, 'Failed to save index snapshot');
    }
  }

  /** Approximate size of the serialized index in MB. */
  estimateSizeMb(): number {
    const termsBytes = termCount(this.index) * 20; // rough estimate per term
    const postingsBytes = this.index.N * 50;
    return Math.round(((termsBytes + postingsBytes) / 1024 / 1024) * 10) / 10;
  }
}

// ---------------------------------------------------------------------------
// Stream message parsing
// ---------------------------------------------------------------------------

interface StreamDoc {
  id: string;
  url: string;
  title: string;
  text: string;
  crawledAt: string;
  wordCount: number;
}

export function parseStreamMessage(fields: string[]): StreamDoc | null {
  // Redis XREAD returns fields as a flat [key, value, key, value...] array
  const map: Record<string, string> = {};
  for (let i = 0; i < fields.length - 1; i += 2) {
    map[fields[i] as string] = fields[i + 1] as string;
  }
  if (!map['id'] || !map['url'] || !map['text']) return null;
  return {
    id: map['id'] as string,
    url: map['url'] as string,
    title: map['title'] ?? '',
    text: map['text'] as string,
    crawledAt: map['crawledAt'] ?? new Date().toISOString(),
    wordCount: parseInt(map['wordCount'] ?? '0', 10),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
