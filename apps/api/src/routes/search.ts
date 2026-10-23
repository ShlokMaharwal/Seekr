import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { search, extractTerms, parseQuery } from '@seekr/core';
import type { IndexManager } from '../index-manager.js';
import type { QueryCache } from '../cache.js';
import type { MetricsTracker } from '../metrics.js';

const SearchSchema = z.object({
  q: z.string().trim().min(1).max(500),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  ranker: z.enum(['bm25', 'tfidf']).default('bm25'),
});

export function searchRouter(im: IndexManager, cache: QueryCache, metrics: MetricsTracker): Router {
  const router = Router();
  const titleWeight = z.coerce
    .number()
    .min(0)
    .max(20)
    .parse(process.env['BM25_TITLE_WEIGHT'] ?? 0);
  const maxRequests = z.coerce
    .number()
    .int()
    .min(1)
    .max(1_000_000)
    .parse(process.env['SEARCH_RATE_LIMIT_MAX'] ?? 60);
  router.use(
    rateLimit({ windowMs: 60_000, max: maxRequests, standardHeaders: true, legacyHeaders: false }),
  );
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    const parsed = SearchSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.flatten() });
      return;
    }
    const { q, page, limit, ranker } = parsed.data;
    const start = performance.now();
    try {
      // Redis is an optional accelerator for an already-loaded index.
      const cached = await cache.get(q, ranker, page, limit).catch(() => null);
      await (cached ? metrics.recordCacheHit() : metrics.recordCacheMiss()).catch(() => {});
      await metrics.recordQuery(q).catch(() => {});
      im.recordQuery(extractTerms(parseQuery(q)));
      if (cached) {
        res.json(cached);
        return;
      }
      const result = search(im.index, q, im.docTexts, im.bigramIndex, {
        page,
        limit,
        ranker,
        bm25: { titleWeight },
      });
      const response = {
        total: result.total,
        tookMs: Math.round((performance.now() - start) * 100) / 100,
        didYouMean: result.didYouMean ?? undefined,
        results: result.results.map((r) => {
          const meta = im.index.docs.get(r.docId);
          return {
            id: r.docId,
            title: meta?.title ?? '',
            url: meta?.url ?? '',
            snippet: r.snippet.text,
            score: Math.round(r.score * 1000) / 1000,
          };
        }),
      };
      await metrics.recordLatency(response.tookMs).catch(() => {});
      await cache.set(q, ranker, page, limit, response).catch(() => {});
      res.json(response);
    } catch (err) {
      next(err);
    }
  });
  return router;
}
