/**
 * Admin routes
 *
 * GET  /admin/stats          - corpus & crawl statistics
 * GET  /admin/crawl/feed     - recent crawl events (capped list)
 * GET  /admin/metrics        - latency p50/p99, crawl rate, top queries
 * POST /admin/crawl/start    - start a new crawl
 * POST /admin/crawl/pause    - pause the running crawl
 * POST /admin/crawl/stop     - stop and reset the crawl
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { type Redis } from 'ioredis';
import { termCount } from '@seekr/core';
import type { IndexManager } from '../index-manager.js';
import type { MetricsTracker } from '../metrics.js';
import type { DocumentStore } from '../store.js';

// Redis keys (must match crawler)
const K_CONTROL = 'crawl:control';
const K_CONFIG  = 'crawl:config';
const K_QUEUE   = 'stats:queueSize';
const K_DUPS    = 'stats:duplicates';
const K_FAIL    = 'stats:failures';
const K_FEED    = 'feed:events';
const K_CRAWL_RATE = 'stats:crawlRate';

const StartSchema = z.object({
  seeds: z.array(z.string().url()).min(1),
  maxPages: z.number().int().min(1).max(1_000_000).default(10_000),
  delayMs: z.number().int().min(0).max(60_000).default(500),
  workers: z.number().int().min(1).max(10).default(1),
});

export function adminRouter(
  indexManager: IndexManager,
  metrics: MetricsTracker,
  store: DocumentStore,
  redis: Redis,
): Router {
  const router = Router();

  // -------------------------------------------------------------------------
  // GET /admin/stats
  // -------------------------------------------------------------------------
  router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const [docs, queueStr, dupsStr, failStr, pagesPerMin] = await Promise.all([
        store.count(),
        redis.get(K_QUEUE),
        redis.get(K_DUPS),
        redis.get(K_FAIL),
        computePagesPerMin(redis),
      ]);

      res.json({
        docs,
        terms: termCount(indexManager.index),
        indexSizeMb: indexManager.estimateSizeMb(),
        pagesPerMin,
        queueSize: parseInt(queueStr ?? '0', 10),
        duplicates: parseInt(dupsStr ?? '0', 10),
        failures: parseInt(failStr ?? '0', 10),
      });
    } catch (err) {
      next(err);
    }
  });

  // -------------------------------------------------------------------------
  // GET /admin/crawl/feed
  // -------------------------------------------------------------------------
  router.get('/crawl/feed', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const raw = await redis.lrange(K_FEED, 0, 49);
      const events = raw.map((r) => {
        try { return JSON.parse(r); }
        catch { return null; }
      }).filter(Boolean);
      res.json(events);
    } catch (err) {
      next(err);
    }
  });

  // -------------------------------------------------------------------------
  // GET /admin/metrics
  // -------------------------------------------------------------------------
  router.get('/metrics', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const [latency, crawlRate, topQueries] = await Promise.all([
        metrics.getLatencyBuckets(),
        metrics.getCrawlRate(),
        metrics.getTopQueries(20),
      ]);
      res.json({ latency, crawlRate, topQueries });
    } catch (err) {
      next(err);
    }
  });

  // -------------------------------------------------------------------------
  // POST /admin/crawl/start
  // -------------------------------------------------------------------------
  router.post('/crawl/start', async (req: Request, res: Response, next: NextFunction) => {
    const parsed = StartSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid start config', details: parsed.error.flatten() });
      return;
    }
    try {
      if (await redis.get(K_CONTROL) === 'pause') {
        await redis.set(K_CONTROL, 'resume');
        res.status(204).end();
        return;
      }
      await redis.set(K_CONFIG, JSON.stringify(parsed.data));
      await redis.set(K_CONTROL, 'start');
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // -------------------------------------------------------------------------
  // POST /admin/crawl/pause
  // -------------------------------------------------------------------------
  router.post('/crawl/pause', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      await redis.set(K_CONTROL, 'pause');
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // -------------------------------------------------------------------------
  // POST /admin/crawl/stop
  // -------------------------------------------------------------------------
  router.post('/crawl/stop', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      await redis.set(K_CONTROL, 'stop');
      // Reset counters
      await redis.del(K_QUEUE, K_DUPS, K_FAIL);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}

// ---------------------------------------------------------------------------
// Helper: compute pages per minute from the crawl rate ZSET
// ---------------------------------------------------------------------------
async function computePagesPerMin(redis: Redis): Promise<number> {
  const now = Date.now();
  const oneMinuteAgo = now - 60_000;

  // The crawl rate ZSET has member=ts and score=ts (via ZADD NX)
  // The actual count per bucket is the ZINCRBY score — we stored ts as both member and score
  // but ZINCRBY updates the score. So we need to sum scores in the last minute.
  const entries = await redis.zrangebyscore(
    K_CRAWL_RATE, oneMinuteAgo, '+inf', 'WITHSCORES',
  );

  let total = 0;
  for (let i = 0; i < entries.length; i += 2) {
    total += Number(await redis.hget(`${K_CRAWL_RATE}:counts`, entries[i] ?? ''));
  }
  return Math.round(total);
}
