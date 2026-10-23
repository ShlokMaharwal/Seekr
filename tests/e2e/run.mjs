import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { Redis } from 'ioredis';
import { UrlFrontier, processingKey } from '../../apps/crawler/dist/frontier.js';
import { DocumentStore } from '../../apps/crawler/dist/store.js';
import { simHash, simHashBands } from '../../packages/core/dist/index.js';

const origin = process.env.CRAWLER_TEST_ORIGIN ?? 'http://tests:8080';
const redis = new Redis(process.env.REDIS_URL);
const children = [];
const pages = {
  '/': '<title>Fixture catalog</title><main>Welcome to the local fixture catalog. <a href="/binary">Algorithms</a> <a href="/gap">Gapped phrase</a> <a href="/graph">Networks</a> <a href="/private">Private</a></main>',
  '/binary':
    '<title>Binary tree algorithms</title><main>binary tree traversal search algorithm balanced nodes leaves rotation ordering efficient lookup.</main>',
  '/gap':
    '<title>Phrase positions</title><main>binary the tree preserves gaps between indexed tokens after removing stopwords.</main>',
  '/graph':
    '<title>Graph networks</title><main>graph network edges vertices connectivity shortest routes paths breadth depth traversal.</main>',
  '/private': '<title>Forbidden</title><main>forbidden sentinel text must never be indexed</main>',
};
const hits = new Map();
const fixture = createServer((req, res) => {
  const path = req.url ?? '/';
  hits.set(path, (hits.get(path) ?? 0) + 1);
  if (path === '/robots.txt') {
    res.setHeader('Content-Type', 'text/plain');
    res.end('User-agent: *\nDisallow: /private\n');
    return;
  }
  res.setHeader('Content-Type', 'text/html');
  res.end(pages[path] ?? '<main>missing</main>');
});
function launch(entry) {
  const child = spawn(process.execPath, [entry], { env: process.env, stdio: 'inherit' });
  children.push(child);
  return child;
}
async function until(fn, description, timeout = 90_000) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (err) {
      last = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Timed out: ${description}`, { cause: last });
}
const base = 'http://127.0.0.1:4000';
async function json(path) {
  const res = await fetch(base + path);
  assert.equal(res.status, 200, path);
  return res.json();
}
async function stop(child) {
  if (child.exitCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  await Promise.race([
    exited,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Child did not stop')), 15_000).unref(),
    ),
  ]);
}
try {
  await new Promise((resolve) => fixture.listen(8080, '0.0.0.0', resolve));
  // This compose project has its own ephemeral Redis and Mongo. Never point
  // this test at a development/production instance: it deliberately resets keys.
  const frontier = new UrlFrontier({ redis, delayMs: 0 });
  await frontier.enqueue(`${origin}/lease`, 'tests');
  const checkedOut = await Promise.all(['one', 'two', 'three'].map((id) => frontier.dequeue(id)));
  assert.equal(checkedOut.filter(Boolean).length, 1, 'one URL cannot be checked out twice');
  const owner = ['one', 'two', 'three'][checkedOut.findIndex(Boolean)];
  await frontier.complete(owner, `${origin}/lease`, 'tests');
  assert.equal(
    await redis.zcard(processingKey(owner)),
    0,
    'completion removes the exact Lua entry',
  );
  await frontier.enqueue(`${origin}/stale`, 'tests');
  await frontier.dequeue('crashed');
  await redis.zadd(processingKey('crashed'), 0, `${origin}/stale`);
  const reaped = await Promise.all([frontier.reapStale(1000), frontier.reapStale(1000)]);
  assert.equal(
    reaped.reduce((a, b) => a + b),
    1,
    'competing reapers requeue once',
  );
  await frontier.reset();

  // Exercise the Mongo band filter against real storage as well.
  const store = new DocumentStore();
  await store.connect(process.env.MONGO_URL);
  const text = 'unique fingerprint fixture tokens with distinct search engine document semantics';
  const fingerprint = simHash(text);
  await store.upsert({
    id: 'near-fixture',
    url: `${origin}/near-fixture`,
    title: 'Near',
    text,
    contentHash: 'near-fixture',
    crawledAt: new Date().toISOString(),
    wordCount: 11,
    simHash: fingerprint,
    simHashBands: simHashBands(fingerprint),
  });
  assert.equal(await store.hasNearDuplicate(fingerprint, `${origin}/other`, 3), true);
  assert.equal(await store.hasNearDuplicate(fingerprint, `${origin}/near-fixture`, 3), false);
  await store.close();

  let api = launch('apps/api/dist/main.js');
  await until(() => json('/health'), 'API health');
  launch('apps/crawler/dist/main.js');
  const response = await fetch(base + '/admin/crawl/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.ADMIN_TOKEN}`,
    },
    body: JSON.stringify({ seeds: [origin + '/'], maxPages: 10, delayMs: 50, workers: 3 }),
  });
  assert.equal(response.status, 204);
  await until(
    async () =>
      (await json('/search?q=' + encodeURIComponent(`algorithm OR waiting${Date.now()}`))).results
        .length,
    'crawler → Mongo → stream → index',
  );
  await until(
    async () =>
      (await json('/search?q=' + encodeURIComponent(`graph OR waiting${Date.now()}`))).results
        .length,
    'all fixture pages indexed',
  );
  const exact = await json('/search?q=' + encodeURIComponent('"binary tree"'));
  assert.deepEqual(
    exact.results.map((r) => r.url),
    [origin + '/binary'],
  );
  const gap = await json('/search?q=' + encodeURIComponent('"binary the tree"'));
  assert.deepEqual(
    gap.results.map((r) => r.url),
    [origin + '/gap'],
  );
  assert.ok((await json('/autocomplete?q=bin')).suggestions.includes('binari'));
  assert.equal((await json('/search?q=algoritm')).didYouMean, 'algorithm');
  assert.equal((await json('/search?q=forbidden')).total, 0);
  assert.equal(hits.get('/private') ?? 0, 0, 'robots-disallowed page is never fetched');
  assert.ok((await json('/doc/' + exact.results[0].id)).text.includes('binary tree'));
  for (const path of ['/binary', '/gap', '/graph'])
    assert.equal(hits.get(path), 1, `${path} fetched once by competing workers`);
  const repeat = await json('/search?q=algorithm');
  assert.deepEqual(await json('/search?q=algorithm'), repeat, 'warm cache response');
  await stop(api);
  api = launch('apps/api/dist/main.js');
  await until(() => json('/health'), 'API restart');
  // Clear only test query-cache keys to prove the snapshot, not cached results,
  // supplies snippets after restart.
  const keys = await redis.keys('cache:search:*');
  if (keys.length) await redis.del(...keys);
  assert.ok((await json('/search?q=algorithm')).results.every((r) => r.snippet.length > 0));
  console.log(
    'PASS: real Redis/Mongo queue concurrency, near duplicates, crawl, phrases, autocomplete, typo, cache, and snapshot restart',
  );
} finally {
  await Promise.all(children.map((child) => stop(child).catch(() => child.kill('SIGKILL'))));
  await redis.quit();
  await new Promise((resolve) => fixture.close(resolve));
}
