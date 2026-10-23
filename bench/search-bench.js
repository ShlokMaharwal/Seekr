import { performance } from 'node:perf_hooks';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
export const QUERIES = [
  'binary tree',
  'graph algorithm',
  'search engine',
  'machine learning',
  'data structure',
  'distributed computing',
  'hash table',
  'sorting algorithm',
  'information retrieval',
  'database transaction',
];
export async function runSearchBench({
  apiUrl = 'http://localhost:4001',
  durationSec = 5,
  concurrency = 5,
} = {}) {
  const rows = [];
  for (const ranker of ['bm25', 'tfidf'])
    for (const warm of [false, true]) {
      async function query(q) {
        const response = await fetch(`${apiUrl}/search?${new URLSearchParams({ q, ranker })}`, {
          signal: AbortSignal.timeout(10_000),
        });
        await response.arrayBuffer();
        return response.status;
      }
      if (warm)
        for (const q of QUERIES) {
          const status = await query(q);
          if (status !== 200)
            throw new Error(
              `Warmup HTTP ${status}; use SEARCH_RATE_LIMIT_MAX=1000000 for local benchmarks`,
            );
        }
      let counter = 0,
        successes = 0,
        errors = 0;
      const nonce = randomBytes(10).toString('hex');
      const latencies = [];
      const start = performance.now();
      const end = start + durationSec * 1000;
      async function worker() {
        while (performance.now() < end) {
          const i = counter++;
          const normal = QUERIES[i % QUERIES.length];
          // A unique, absent OR term preserves matches while guaranteeing a new
          // cache key. It adds parsing/typo work, which the report discloses.
          const q = warm ? normal : `${normal} OR seekrbenchnonce${nonce}${i}`;
          const t0 = performance.now();
          try {
            if ((await query(q)) === 200) {
              successes++;
              latencies.push(performance.now() - t0);
            } else errors++;
          } catch {
            errors++;
          }
        }
      }
      await Promise.all(Array.from({ length: concurrency }, worker));
      latencies.sort((a, b) => a - b);
      const percentile = (p) =>
        latencies.length
          ? latencies[Math.min(latencies.length - 1, Math.ceil(p * latencies.length) - 1)]
          : null;
      rows.push({
        scenario: `${ranker.toUpperCase()} ${warm ? 'warm' : 'cold'}`,
        rps: successes / ((performance.now() - start) / 1000),
        p50: percentile(0.5),
        p95: percentile(0.95),
        p99: percentile(0.99),
        successes,
        errors,
      });
    }
  return rows;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(
    JSON.stringify(
      await runSearchBench({
        apiUrl: process.argv[2],
        durationSec: Number(process.argv[3] ?? 5),
        concurrency: Number(process.argv[4] ?? 5),
      }),
      null,
      2,
    ),
  );
}
