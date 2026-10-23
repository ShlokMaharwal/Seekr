import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { writeFile } from 'node:fs/promises';
import os from 'node:os';
import { Redis } from 'ioredis';
import { runSearchBench } from '../../bench/search-bench.js';
import { runCrawlBench } from '../../bench/crawl-bench.js';
import { compareRankers } from '../../bench/ranker-compare.js';

const origin = process.env.CRAWLER_TEST_ORIGIN;
const base = 'http://127.0.0.1:4000';
const children = [];
const total = 1000;
const redis = new Redis(process.env.REDIS_URL);
const server = createServer((req, res) => {
  if (req.url === '/robots.txt') {
    res.setHeader('Content-Type', 'text/plain');
    res.end('User-agent: *\nAllow: /');
    return;
  }
  res.setHeader('Content-Type', 'text/html');
  setTimeout(() => {
    const id = req.url?.slice(1) ?? '';
    const links = id
      ? ''
      : Array.from({ length: total }, (_, i) => `<a href="/${i}">Page ${i}</a>`).join(' ');
    res.end(
      `<title>Computer science ${id}</title><main>binary tree graph algorithm search engine machine learning data structure distributed computing hash table sorting algorithm information retrieval database transaction fixture ${id}. ${links}</main>`,
    );
  }, 20);
});
async function until(fn, label) {
  const end = Date.now() + 180_000;
  while (Date.now() < end) {
    try {
      if (await fn()) return;
    } catch {
      /* Process startup. */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Benchmark setup timed out: ${label}`);
}
function launch(entry) {
  const child = spawn(process.execPath, [entry], { env: process.env, stdio: 'inherit' });
  children.push(child);
}
try {
  await new Promise((resolve) => server.listen(8080, '0.0.0.0', resolve));
  launch('apps/api/dist/main.js');
  await until(async () => (await fetch(base + '/health')).ok, 'API');
  launch('apps/crawler/dist/main.js');
  const response = await fetch(base + '/admin/crawl/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.ADMIN_TOKEN}`,
    },
    body: JSON.stringify({ seeds: [origin + '/'], workers: 5, maxPages: total + 2, delayMs: 0 }),
  });
  if (!response.ok) throw new Error(`Seed HTTP ${response.status}`);
  await until(
    async () => Number((await redis.get('stats:fetched')) ?? 0) >= total + 1,
    'fixture crawl',
  );
  await until(async () => {
    const response = await fetch(
      base + '/search?q=' + encodeURIComponent(`fixture OR nonce${Date.now()}`),
    );
    return response.ok && (await response.json()).total >= total + 1;
  }, 'index catch-up');
  const crawl = await runCrawlBench({
    apiUrl: base,
    redisUrl: process.env.REDIS_URL,
    seeds: [origin + '/'],
    seconds: 5,
  });
  const search = await runSearchBench({ apiUrl: base, durationSec: 5, concurrency: 5 });
  const comparison = await compareRankers(base);
  const report = {
    source: 'Isolated Docker HTTP fixture with real Redis and MongoDB',
    commit: process.env.BENCH_COMMIT,
    measuredAt: new Date().toISOString(),
    machine: `${os.cpus()[0]?.model}; ${(os.totalmem() / 2 ** 30).toFixed(1)} GiB RAM; ${os.platform()} ${os.release()}; Node ${process.version}`,
    corpusSize: total + 1,
    search,
    crawl,
    comparison,
  };
  await writeFile('/artifacts/service-bench.json', JSON.stringify(report, null, 2));
  console.log('SEEKR_BENCHMARK_JSON=' + JSON.stringify(report));
  console.log('Saved /artifacts/service-bench.json');
} finally {
  for (const child of children) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    await Promise.race([
      exited,
      new Promise((resolve) =>
        setTimeout(() => {
          child.kill('SIGKILL');
          resolve();
        }, 15_000).unref(),
      ),
    ]);
  }
  await redis.quit();
  await new Promise((resolve) => server.close(resolve));
}
