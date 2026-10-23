import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Redis } from 'ioredis';
import { createApp } from '../src/app.js';
import { IndexManager } from '../src/index-manager.js';
import { DocumentStore } from '../src/store.js';
import { QueryCache } from '../src/cache.js';
import { MetricsTracker } from '../src/metrics.js';

describe('REST contract', () => {
  const values = new Map<string, string>();
  const redis = new Redis({ lazyConnect: true });
  const store = new DocumentStore();
  beforeEach(() => {
    values.clear();
    vi.stubEnv('ADMIN_TOKEN', 'test-token');
    vi.stubEnv('NODE_ENV', 'test');
    vi.spyOn(redis, 'get').mockImplementation(async (key) => values.get(String(key)) ?? null);
    vi.spyOn(redis, 'set').mockImplementation(async (key, value) => {
      values.set(String(key), String(value));
      return 'OK';
    });
    vi.spyOn(redis, 'incr').mockResolvedValue(1);
    vi.spyOn(redis, 'zincrby').mockResolvedValue('1');
    vi.spyOn(redis, 'zadd').mockResolvedValue(1);
    vi.spyOn(redis, 'zcard').mockResolvedValue(1);
    vi.spyOn(redis, 'zremrangebyscore').mockResolvedValue(0);
    vi.spyOn(redis, 'zrangebyscore').mockResolvedValue([]);
    vi.spyOn(redis, 'zrevrangebyscore').mockResolvedValue([]);
    vi.spyOn(redis, 'lrange').mockResolvedValue([]);
    vi.spyOn(redis, 'del').mockResolvedValue(1);
    vi.spyOn(store, 'count').mockResolvedValue(2);
    vi.spyOn(store, 'findById').mockImplementation(async (id) =>
      id === 'a'
        ? {
            id,
            url: 'https://example.org/a',
            title: 'Binary tree',
            text: 'binary tree search algorithm',
            crawledAt: '2026-10-23T00:00:00Z',
            wordCount: 4,
            contentHash: 'hash',
          }
        : null,
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });
  function app() {
    const indexManager = new IndexManager(redis);
    indexManager.indexDocument(
      'a',
      'binary tree search algorithm',
      'Binary tree',
      'https://example.org/a',
    );
    indexManager.indexDocument('b', 'binary the tree network', 'Other', 'https://example.org/b');
    return createApp({
      redis,
      store,
      indexManager,
      cache: new QueryCache(redis),
      metrics: new MetricsTracker(redis),
    });
  }
  const auth = { Authorization: 'Bearer test-token' };
  it('serves health and a predictable 404', async () => {
    expect((await request(app()).get('/health')).body.status).toBe('ok');
    await request(app()).get('/missing').expect(404);
  });
  it('searches with exact totals, phrases, rankers, and cache hits', async () => {
    const server = app();
    const first = await request(server).get('/search').query({ q: 'binary', limit: 1 }).expect(200);
    expect(first.body.total).toBe(2);
    expect(first.body.results).toHaveLength(1);
    expect(first.body.results[0].snippet).not.toBe('');
    const second = await request(server)
      .get('/search')
      .query({ q: 'binary', limit: 1 })
      .expect(200);
    expect(second.body).toEqual(first.body);
    expect(
      (await request(server).get('/search').query({ q: '"binary the tree"' })).body.results[0].id,
    ).toBe('b');
    await request(server).get('/search').query({ q: 'binary', ranker: 'tfidf' }).expect(200);
  });
  it.each([
    { q: '' },
    { q: 'x', page: 0 },
    { q: 'x', limit: 51 },
    { q: 'x', page: 1001 },
    { q: 'x', ranker: 'bad' },
    { q: 'x'.repeat(501) },
  ])('rejects invalid query %j', async (query) => {
    await request(app()).get('/search').query(query).expect(400);
  });
  it('serves autocomplete and document lookups with validation', async () => {
    expect((await request(app()).get('/autocomplete?q=bin')).body.suggestions).toContain('binari');
    expect((await request(app()).get('/autocomplete?q=')).body.suggestions).toEqual([]);
    await request(app()).get('/doc/a').expect(200);
    await request(app()).get('/doc/missing').expect(404);
    await request(app())
      .get('/doc/' + 'x'.repeat(129))
      .expect(400);
  });
  it.each(['/admin/stats', '/admin/metrics', '/admin/crawl/feed'])(
    'protects %s and serves it with a token',
    async (path) => {
      await request(app()).get(path).expect(401);
      await request(app()).get(path).set('Authorization', 'Bearer wrong').expect(403);
      await request(app()).get(path).set(auth).expect(200);
    },
  );
  it('validates and executes every crawl control', async () => {
    const server = app();
    const settings = { seeds: ['https://example.org/'], maxPages: 10, delayMs: 10, workers: 2 };
    await request(server)
      .post('/admin/crawl/start')
      .set(auth)
      .send({ seeds: ['file:///tmp/a'] })
      .expect(400);
    await request(server).post('/admin/crawl/start').send(settings).expect(401);
    await request(server).post('/admin/crawl/start').set(auth).send(settings).expect(204);
    expect(values.get('crawl:control')).toBe('start');
    await request(server).post('/admin/crawl/pause').set(auth).send({}).expect(204);
    await request(server).post('/admin/crawl/start').set(auth).send(settings).expect(204);
    expect(values.get('crawl:control')).toBe('resume');
    await request(server).post('/admin/crawl/stop').set(auth).send({}).expect(204);
  });
  it('disables tokenless production admin routes and permits dev mode', async () => {
    vi.stubEnv('ADMIN_TOKEN', '');
    vi.stubEnv('NODE_ENV', 'production');
    await request(app()).get('/admin/stats').expect(503);
    vi.stubEnv('NODE_ENV', 'development');
    await request(app()).get('/admin/stats').expect(200);
  });
  it('uses configurable CORS and rate limits search', async () => {
    vi.stubEnv('CORS_ORIGINS', 'https://allowed.example');
    const server = app();
    expect(
      (await request(server).get('/health').set('Origin', 'https://allowed.example')).headers[
        'access-control-allow-origin'
      ],
    ).toBe('https://allowed.example');
    expect(
      (await request(server).get('/health').set('Origin', 'https://other.example')).headers[
        'access-control-allow-origin'
      ],
    ).toBeUndefined();
    for (let i = 0; i < 60; i++) await request(server).get('/search?q=binary').expect(200);
    await request(server).get('/search?q=binary').expect(429);
  });
  it('keeps cache keys distinct and serves search through a Redis outage', async () => {
    const cache = new QueryCache(redis);
    await cache.set('x+y', 'bm25', 1, 10, { total: 1, tookMs: 1, results: [] });
    expect(await cache.get('x-y', 'bm25', 1, 10)).toBeNull();
    vi.spyOn(redis, 'get').mockRejectedValue(new Error('offline'));
    await request(app()).get('/search?q=binary').expect(200);
  });
});
