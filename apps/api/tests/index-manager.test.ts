import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { IndexManager } from '../src/index-manager.js';
import type { DocumentStore } from '../src/store.js';
import type { Redis } from 'ioredis';

describe('IndexManager', () => {
  let tempDir: string;
  let snapshotFile: string;
  let mockRedis: Redis;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'seekr-im-test-'));
    snapshotFile = path.join(tempDir, 'snapshot.json');

    mockRedis = {
      xack: vi.fn().mockResolvedValue(1),
      xadd: vi.fn().mockResolvedValue('1-0'),
      xreadgroup: vi.fn().mockResolvedValue(null),
      xautoclaim: vi.fn().mockResolvedValue(['0-0', []]),
      xgroup: vi.fn().mockResolvedValue('OK'),
    } as unknown as Redis;
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('rebuilds index from MongoDB when snapshot file is missing', async () => {
    const mockStore = {
      stream: async function* () {
        yield {
          id: 'doc-mongo-1',
          text: 'distributed systems consensus raft',
          title: 'Distributed Systems',
          url: 'http://example.com/distributed',
          crawledAt: new Date().toISOString(),
          wordCount: 4,
          contentHash: 'hash1',
        };
        yield {
          id: 'doc-mongo-2',
          text: 'binary search tree algorithmic complexity',
          title: 'Binary Search Tree',
          url: 'http://example.com/bst',
          crawledAt: new Date().toISOString(),
          wordCount: 5,
          contentHash: 'hash2',
        };
      },
      count: async () => 2,
    } as unknown as DocumentStore;

    const manager = new IndexManager(mockRedis, mockStore, snapshotFile);
    await manager.load();

    expect(manager.index.N).toBe(2);
    expect(manager.index.docs.has('doc-mongo-1')).toBe(true);
    expect(manager.index.docs.has('doc-mongo-2')).toBe(true);
    expect(manager.docTexts.get('doc-mongo-1')).toBe('distributed systems consensus raft');

    // Auxiliary structures should be populated
    expect(manager.trie.suggest('distribut', 5)).toContain('distribut');
  });

  it('falls back to MongoDB rebuild when snapshot is corrupted', async () => {
    // Write corrupt snapshot file
    await fs.writeFile(snapshotFile, '{ corrupted json: true', 'utf8');

    const mockStore = {
      stream: async function* () {
        yield {
          id: 'doc-1',
          text: 'database indexing btree',
          title: 'Database Indexing',
          url: 'http://example.com/db',
          crawledAt: new Date().toISOString(),
          wordCount: 3,
          contentHash: 'hash1',
        };
      },
      count: async () => 1,
    } as unknown as DocumentStore;

    const manager = new IndexManager(mockRedis, mockStore, snapshotFile);
    await manager.load();

    expect(manager.index.N).toBe(1);
    expect(manager.index.docs.has('doc-1')).toBe(true);
  });

  it('handles poison stream messages by logging to DLQ and acknowledging', async () => {
    const manager = new IndexManager(mockRedis, undefined, snapshotFile);

    // Poison message with missing id/url/text
    const badFields = ['random_key', 'random_value'];
    await manager.processStreamMessage('1001-0', badFields);

    // Should write to dead-letter queue
    expect(mockRedis.xadd).toHaveBeenCalledWith(
      'stream:new-docs:dlq',
      '*',
      'originalMsgId',
      '1001-0',
      'error',
      'parse_failure',
      'payload',
      JSON.stringify(badFields),
      'ts',
      expect.any(String),
    );

    // Should acknowledge the message so it does not stay pending forever
    expect(mockRedis.xack).toHaveBeenCalledWith('stream:new-docs', 'indexer-group', '1001-0');
  });

  it('indexes valid stream message idempotently without duplicating postings', async () => {
    const manager = new IndexManager(mockRedis, undefined, snapshotFile);

    const validFields = [
      'id', 'doc-stream-1',
      'url', 'http://example.com/stream-1',
      'title', 'Stream Doc',
      'text', 'high throughput streaming architecture',
      'wordCount', '4',
    ];

    // Deliver message twice
    await manager.processStreamMessage('1002-0', validFields);
    await manager.processStreamMessage('1003-0', validFields);

    // Should still have N = 1
    expect(manager.index.N).toBe(1);
    expect(mockRedis.xack).toHaveBeenCalledWith('stream:new-docs', 'indexer-group', '1002-0');
    expect(mockRedis.xack).toHaveBeenCalledWith('stream:new-docs', 'indexer-group', '1003-0');
  });
});
