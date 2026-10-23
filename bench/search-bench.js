#!/usr/bin/env node
/**
 * Search throughput benchmark
 *
 * Measures:
 *   - Requests/sec with and without Redis cache (warm vs cold)
 *   - p50 / p95 / p99 latency
 *   - Compares BM25 vs TF-IDF throughput
 *
 * Usage:
 *   node bench/search-bench.js [apiUrl] [durationSec] [concurrency]
 *
 * Outputs a markdown table.
 */

const API_URL = process.argv[2] ?? 'http://localhost:4000';
const DURATION_SEC = parseInt(process.argv[3] ?? '30', 10);
const CONCURRENCY = parseInt(process.argv[4] ?? '10', 10);

const QUERIES = [
  'binary tree',
  'graph algorithm',
  'search engine ranking',
  'machine learning neural',
  'data structures heap',
  'distributed systems consistency',
  'hash table implementation',
  'sorting algorithm quicksort',
  'information retrieval bm25',
  'compiler parser grammar',
];

async function runBench(label, ranker, warmCache) {
  const latencies = [];
  const start = Date.now();
  const end = start + DURATION_SEC * 1000;
  let requests = 0;
  let errors = 0;

  // Warm the cache if requested
  if (warmCache) {
    await Promise.all(
      QUERIES.map((q) =>
        fetch(`${API_URL}/search?q=${encodeURIComponent(q)}&ranker=${ranker}`).catch(() => {}),
      ),
    );
    await sleep(500);
  }

  // Concurrent request loop
  async function worker() {
    while (Date.now() < end) {
      const q = QUERIES[requests % QUERIES.length];
      const t0 = Date.now();
      try {
        const r = await fetch(`${API_URL}/search?q=${encodeURIComponent(q)}&ranker=${ranker}`);
        if (!r.ok) errors++;
        latencies.push(Date.now() - t0);
        requests++;
      } catch {
        errors++;
        requests++;
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const elapsed = (Date.now() - start) / 1000;
  latencies.sort((a, b) => a - b);

  return {
    label,
    rps: Math.round(requests / elapsed),
    p50: pct(latencies, 50),
    p95: pct(latencies, 95),
    p99: pct(latencies, 99),
    errors,
    requests,
  };
}

function pct(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(idx, sorted.length - 1)];
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function row(r) {
  return `| ${r.label.padEnd(30)} | ${String(r.rps).padStart(7)} | ${String(r.p50).padStart(8)} | ${String(r.p95).padStart(8)} | ${String(r.p99).padStart(8)} | ${String(r.errors).padStart(6)} |`;
}

async function main() {
  console.log(
    `\nSearch benchmark — ${DURATION_SEC}s, concurrency=${CONCURRENCY}, API=${API_URL}\n`,
  );

  const header =
    '| Scenario                       |     RPS |  p50 ms |  p95 ms |  p99 ms | Errors |';
  const sep = '|--------------------------------|---------|---------|---------|---------|--------|';

  const results = await Promise.all([
    runBench('BM25 cold cache', 'bm25', false),
    runBench('BM25 warm cache', 'bm25', true),
    runBench('TF-IDF cold cache', 'tfidf', false),
    runBench('TF-IDF warm cache', 'tfidf', true),
  ]);

  console.log(header);
  console.log(sep);
  for (const r of results) console.log(row(r));
  console.log();
}

main().catch(console.error);
