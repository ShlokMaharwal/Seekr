#!/usr/bin/env node
/**
 * Crawl throughput benchmark
 *
 * Measures pages/min by polling /admin/stats before and after a fixed window.
 * Compare 1 crawler vs 3 crawlers (set in docker-compose scale).
 *
 * Usage:
 *   node bench/crawl-bench.js [apiUrl] [windowSec]
 */

const API_URL = process.argv[2] ?? 'http://localhost:4000';
const WINDOW_SEC = parseInt(process.argv[3] ?? '60', 10);

async function getStats() {
  const r = await fetch(`${API_URL}/admin/stats`);
  return r.json();
}

async function main() {
  console.log(`\nCrawl benchmark — measuring over ${WINDOW_SEC}s window\n`);

  const before = await getStats();
  console.log(`Before: docs=${before.docs}, queue=${before.queueSize}`);

  await sleep(WINDOW_SEC * 1000);

  const after = await getStats();
  console.log(`After:  docs=${after.docs}, queue=${after.queueSize}`);

  const crawled = after.docs - before.docs;
  const pagesPerMin = Math.round((crawled / WINDOW_SEC) * 60);

  console.log(`\n| Metric        | Value              |`);
  console.log(`|---------------|--------------------|`);
  console.log(`| Pages crawled | ${crawled}          |`);
  console.log(`| Window        | ${WINDOW_SEC}s      |`);
  console.log(`| Pages/min     | ${pagesPerMin}      |`);
  console.log(`| Reported p/m  | ${after.pagesPerMin} |`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch(console.error);
