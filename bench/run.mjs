import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import os from 'node:os';
import { format } from 'prettier';
import { createIndex, addDocument, saveIndex, loadIndex } from '../packages/core/dist/index.js';
import { runSearchBench } from './search-bench.js';
import { compareRankers } from './ranker-compare.js';

const apiUrl = process.env.SEEKR_API_URL ?? 'http://localhost:4001';
const tbd = 'TBD (run locally)';
const lines = [
  '# Benchmarks',
  '',
  `Measured ${new Date().toISOString()}.`,
  '',
  `Commit: ${execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()} plus any working changes.`,
  `Machine: ${os.cpus()[0]?.model}; ${(os.totalmem() / 2 ** 30).toFixed(1)} GiB RAM; ${os.platform()} ${os.release()}; Node ${process.version}.`,
  '',
  'Run `npm run build && npm run bench`. For isolated service measurements run `npm run bench:stack`, then `npm run bench` to merge its artifact. No illustrative numbers are used.',
  '',
];
await mkdir('data/bench', { recursive: true });
try {
  const raw = await readFile('data/eval/corpus.json');
  const documents = JSON.parse(raw);
  globalThis.gc?.();
  const before = process.memoryUsage().heapUsed;
  const index = createIndex();
  for (const doc of documents) addDocument(index, doc.id, doc.text, doc.title, doc.url);
  globalThis.gc?.();
  const heap = process.memoryUsage().heapUsed - before;
  await saveIndex(index, 'data/bench/index.bin');
  const bytes = (await stat('data/bench/index.bin')).size;
  await loadIndex('data/bench/index.bin');
  const start = performance.now();
  for (let i = 0; i < 10; i++) await loadIndex('data/bench/index.bin');
  lines.push(
    `## Index measurements`,
    '',
    `Corpus: ${index.N} downloaded Wikipedia articles, SHA-256 ${createHash('sha256').update(raw).digest('hex')}.`,
    '',
    '| Measurement | Value |',
    '|---|---:|',
    `| Incremental index heap after corpus load and GC | ${(heap / 2 ** 20).toFixed(3)} MiB |`,
    `| Process RSS (includes runtime and corpus) | ${(process.memoryUsage().rss / 2 ** 20).toFixed(3)} MiB |`,
    `| Binary snapshot on disk | ${bytes} bytes |`,
    `| Snapshot load, mean of 10 warm-filesystem reads | ${((performance.now() - start) / 10).toFixed(3)} ms |`,
    '',
    'Heap delta is an estimate affected by GC and allocator behavior, not a byte-exact retained-memory measurement. Raw corpus strings are already resident before the baseline. Snapshot timing includes file reads and checksum verification, and excludes MongoDB reconciliation.',
    '',
  );
} catch (error) {
  lines.push(
    '## Index measurements',
    '',
    `${tbd}: ${error.message}. Run node bench/eval/prepare.mjs first.`,
    '',
  );
}
let service = null;
let reason = '';
try {
  service = JSON.parse(await readFile('data/bench/service-bench.json', 'utf8'));
} catch {
  /* An isolated service run is optional. */
}
if (!service) {
  try {
    const response = await fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(2500) });
    if (!response.ok) throw new Error(`Health HTTP ${response.status}`);
    service = {
      source: `Live API ${apiUrl}`,
      corpusSize: null,
      search: await runSearchBench({ apiUrl }),
      comparison: await compareRankers(apiUrl),
      crawl: null,
    };
  } catch (error) {
    reason = error.message;
  }
}
lines.push(
  '## HTTP search',
  '',
  service
    ? `Source: ${service.source}; corpus: ${service.corpusSize ?? 'unknown'} documents. ${service.measuredAt ?? ''} ${service.machine ?? ''}. Service commit: ${service.commit ?? 'unrecorded'}.`
    : `${tbd}: ${reason || 'no stack artifact'}.`,
  '',
  '| Scenario | Successful req/s | p50 ms | p95 ms | p99 ms | Errors |',
  '|---|---:|---:|---:|---:|---:|',
);
for (const scenario of ['BM25 cold', 'BM25 warm', 'TFIDF cold', 'TFIDF warm']) {
  const row = service?.search?.find((r) => r.scenario === scenario);
  lines.push(
    row
      ? `| ${scenario} | ${row.rps.toFixed(2)} | ${row.p50?.toFixed(3) ?? tbd} | ${row.p95?.toFixed(3) ?? tbd} | ${row.p99?.toFixed(3) ?? tbd} | ${row.errors} |`
      : `| ${scenario} | ${tbd} | ${tbd} | ${tbd} | ${tbd} | ${tbd} |`,
  );
}
lines.push(
  '',
  'Cold requests use unique absent OR terms to guarantee misses without changing matching documents; they include that extra parsing and typo-check cost. Warm requests repeat ten fixed queries after prefill. Scenarios run sequentially, warmup is excluded from elapsed time, response bodies are consumed, and non-200 responses count as errors. Set SEARCH_RATE_LIMIT_MAX=1000000 only on the isolated local benchmark API.',
  '',
  '## Crawl throughput',
  '',
  '| Workers in one process | HTML pages processed/min | Pages fetched |',
  '|---|---:|---:|',
);
for (const workers of [1, 3]) {
  const row = service?.crawl?.find((r) => r.workers === workers);
  lines.push(`| ${workers} | ${row?.pagesPerMin.toFixed(2) ?? tbd} | ${row?.fetched ?? tbd} |`);
}
lines.push(
  '',
  'The isolated fixture adds 20 ms response latency, uses zero domain delay, and prewarms MongoDB so both crawl runs encounter the same stored corpus. It counts fetched HTML including content duplicates, excludes robots skips and failures, and includes stop/drain time. This measures worker concurrency, not three independent crawler processes or Internet crawl throughput.',
  '',
  '## Ranking comparison',
  '',
  service?.comparison ??
    `${tbd}. Real Wikipedia relevance metrics are in [EVALUATION.md](EVALUATION.md).`,
  '',
  'Algorithm-only autocomplete and equivalent JSON/binary codec comparisons are measured separately in [MICROBENCHMARKS.md](MICROBENCHMARKS.md). These are synthetic microbenchmarks, not service throughput.',
  '',
);
await writeFile('docs/BENCHMARKS.md', await format(lines.join('\n'), { parser: 'markdown' }));
console.log(lines.join('\n'));
