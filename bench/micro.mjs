import { performance } from 'node:perf_hooks';
import { mkdir, writeFile } from 'node:fs/promises';
import { createIndex, addDocument, encodeIndex, decodeIndex, encodeLegacyIndex, Trie } from '../packages/core/dist/index.js';
import os from 'node:os';
import assert from 'node:assert/strict';
const trie = new Trie();
for (let i = 0; i < 10000; i++) trie.insert(`term${i}`, i % 101 + 1);
assert.deepEqual(trie.suggest('term'), trie.suggestUncached('term'));
function time(fn, iterations) { const start = performance.now(); for (let i = 0; i < iterations; i++) fn(); return (performance.now() - start) / iterations; }
time(() => trie.suggest('term'), 1000); time(() => trie.suggestUncached('term'), 10);
const cached = time(() => trie.suggest('term'), 5000), traversal = time(() => trie.suggestUncached('term'), 100);
const index = createIndex();
for (let i = 0; i < 500; i++) addDocument(index, `doc-${i}`, `Binary tree search algorithm graph ${i} `.repeat(20), `Document ${i}`, `https://example.org/${i}`);
const binary = encodeIndex(index), json = Buffer.from(encodeLegacyIndex(index));
// Posting order is canonicalized by the binary encoder; compare equivalent
// encodings rather than the insertion order of otherwise identical postings.
assert.deepEqual(encodeIndex(decodeIndex(binary)), encodeIndex(decodeIndex(json)));
const binaryMs = time(() => decodeIndex(binary), 30), jsonMs = time(() => decodeIndex(json), 30);
const content = `# Algorithm microbenchmarks\n\nMeasured ${new Date().toISOString()} on ${os.cpus()[0]?.model}, ${(os.totalmem()/2**30).toFixed(1)} GiB RAM, ${os.platform()} ${os.release()}, Node ${process.version}.\n\nSynthetic data, not Wikipedia or live-service throughput. Build before running node bench/micro.mjs. Timings are per operation after warmup, with no performance assertion in CI.\n\n| Trie lookup (10,000 terms, common prefix) | ms/op |\n|---|---:|\n| Cached top-6 (5,000 iterations) | ${cached.toFixed(6)} |\n| Full traversal (100 iterations) | ${traversal.toFixed(6)} |\n\nMeasured speedup: ${(traversal/cached).toFixed(1)}×.\n\n| Snapshot (500 synthetic documents) | Bytes | Decode ms/op (30 iterations) |\n|---|---:|---:|\n| Delta-encoded JSON, including text and fields | ${json.length} | ${jsonMs.toFixed(3)} |\n| Binary varint + ordinal/position deltas | ${binary.length} | ${binaryMs.toFixed(3)} |\n\nBoth representations contain equivalent documents, title/body postings and snippet text. Includes checksum verification for binary. Disk I/O and API reconciliation are excluded; this isolates the codec. Results depend on CPU and corpus.\n`;
await mkdir('docs', { recursive: true }); await writeFile('docs/MICROBENCHMARKS.md', content); console.log(content);
