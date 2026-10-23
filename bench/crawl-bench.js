import { Redis } from 'ioredis';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
export async function runCrawlBench({
  apiUrl,
  redisUrl,
  seeds,
  seconds = 5,
  token = process.env.ADMIN_TOKEN ?? '',
  delayMs = 0,
}) {
  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
  const rows = [];
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function control(action, config = {}) {
    const response = await fetch(`${apiUrl}/admin/crawl/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(config),
    });
    if (response.status !== 204) throw new Error(`Crawl ${action}: HTTP ${response.status}`);
  }
  async function waitStopped() {
    const until = Date.now() + 30_000;
    while (Date.now() < until) {
      if ((await redis.get('crawl:control')) === 'stopped') return;
      await pause(100);
    }
    throw new Error('Crawler did not stop; no comparison was recorded');
  }
  try {
    for (const workers of [1, 3]) {
      await control('stop');
      await waitStopped();
      const before = Number((await redis.get('stats:fetched')) ?? 0);
      await control('start', { seeds, workers, delayMs, maxPages: 100_000 });
      const started = Date.now();
      await pause(seconds * 1000);
      await control('stop');
      await waitStopped();
      const fetched = Number((await redis.get('stats:fetched')) ?? 0) - before;
      const elapsed = (Date.now() - started) / 1000;
      rows.push({ workers, fetched, seconds: elapsed, pagesPerMin: (fetched * 60) / elapsed });
    }
    return rows;
  } finally {
    await redis.quit();
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.env.BENCH_CRAWL_SEEDS)
    throw new Error('Set BENCH_CRAWL_SEEDS to a JSON seed array on an isolated test stack.');
  console.log(
    JSON.stringify(
      await runCrawlBench({
        apiUrl: process.argv[2] ?? 'http://localhost:4001',
        redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
        seeds: JSON.parse(process.env.BENCH_CRAWL_SEEDS),
        seconds: Number(process.argv[3] ?? 5),
      }),
      null,
      2,
    ),
  );
}
