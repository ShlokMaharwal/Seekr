import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { createIndex, addDocument } from '../src/inverted-index.js';
import { saveIndex, loadIndex, loadOrCreate } from '../src/serializer.js';

describe('serializer', () => {
  let tempDir: string;
  let snapshotFile: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'seekr-test-'));
    snapshotFile = path.join(tempDir, 'index.json');
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('saves and loads an index with delta-encoded positions', async () => {
    const original = createIndex();
    addDocument(original, 'doc1', 'distributed consensus protocol algorithm', 'Doc 1', 'http://example.com/1');
    addDocument(original, 'doc2', 'search engine algorithm design', 'Doc 2', 'http://example.com/2');

    await saveIndex(original, snapshotFile);

    // Verify snapshot file exists
    const stat = await fs.stat(snapshotFile);
    expect(stat.size).toBeGreaterThan(0);

    const loaded = await loadIndex(snapshotFile);
    expect(loaded.N).toBe(original.N);
    expect(loaded.avgDocLen).toBe(original.avgDocLen);
    expect(loaded.docs.size).toBe(original.docs.size);
    expect(loaded.postings.size).toBe(original.postings.size);

    // Verify posting positions match
    const origPostings = original.postings.get('algorithm') ?? [];
    const loadedPostings = loaded.postings.get('algorithm') ?? [];
    expect(loadedPostings).toEqual(origPostings);
  });

  it('loadOrCreate returns fresh empty index when file is missing', async () => {
    const missingPath = path.join(tempDir, 'nonexistent.json');
    const index = await loadOrCreate(missingPath);
    expect(index.N).toBe(0);
    expect(index.avgDocLen).toBe(0);
    expect(index.postings.size).toBe(0);
  });

  it('loadOrCreate tolerates corrupt/partial snapshot file by returning empty index', async () => {
    // Write partial/corrupted JSON
    await fs.writeFile(snapshotFile, '{"version": 1, "N": 10, "postings": [ [corrupt json', 'utf8');

    const index = await loadOrCreate(snapshotFile);
    expect(index.N).toBe(0);
    expect(index.avgDocLen).toBe(0);
  });
});
