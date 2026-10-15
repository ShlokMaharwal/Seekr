/**
 * Search route: GET /search
 *
 * Query params (validated with zod):
 *   q       - raw query string (required)
 *   page    - page number, default 1
 *   limit   - results per page, default 10 (max 50)
 *   ranker  - 'bm25' | 'tfidf', default 'bm25'
 *
 * Response (SearchResponse):
 *   { total, tookMs, didYouMean?, results: [{ id, title, url, snippet, score }] }
 *
 * Cache:
 *   Results are cached in Redis for 60 seconds. Cache key = ranker:page:limit:q.
 *   Cache hit rate is tracked in metrics.
 */
import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { parseQuery, extractTerms, scoreBM25, scoreTFIDF, generateSnippet, didYouMean, df, } from '@seekr/core';
import { phraseMatchesDoc, getPostings } from '@seekr/core';
const SearchSchema = z.object({
    q: z.string().min(1).max(500),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    ranker: z.enum(['bm25', 'tfidf']).default('bm25'),
});
// Rate limiter: 60 requests per minute per IP
const limiter = rateLimit({
    windowMs: 60_000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many search requests, please slow down.' },
});
export function searchRouter(indexManager, cache, metrics) {
    const router = Router();
    router.use(limiter);
    router.get('/', async (req, res, next) => {
        const parsed = SearchSchema.safeParse(req.query);
        if (!parsed.success) {
            res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.flatten() });
            return;
        }
        const { q, page, limit, ranker } = parsed.data;
        const start = Date.now();
        // Check Redis cache
        const cached = await cache.get(q, ranker, page, limit);
        if (cached) {
            await metrics.recordCacheHit();
            res.json(cached);
            return;
        }
        await metrics.recordCacheMiss();
        try {
            const result = executeSearch(q, page, limit, ranker, indexManager);
            const tookMs = Date.now() - start;
            const response = { ...result, tookMs };
            // Record metrics
            await metrics.recordLatency(tookMs);
            await metrics.recordQuery(q);
            indexManager.recordQuery(extractTerms(parseQuery(q)));
            // Store in cache
            await cache.set(q, ranker, page, limit, response);
            res.json(response);
        }
        catch (err) {
            next(err);
        }
    });
    return router;
}
// ---------------------------------------------------------------------------
// Core search logic (sync — the index is in-memory)
// ---------------------------------------------------------------------------
function executeSearch(rawQuery, page, limit, ranker, im) {
    const { index, bigramIndex, docTexts } = im;
    const clause = parseQuery(rawQuery);
    const queryTerms = extractTerms(clause);
    // Build per-term hit counts for "did you mean"
    const hitCounts = new Map();
    for (const t of queryTerms)
        hitCounts.set(t, df(index, t));
    const suggestion = didYouMean(queryTerms, hitCounts, bigramIndex);
    // Rank with top-K heap; fetch extra to handle phrase filtering
    const topK = page * limit + 20;
    const ranked = ranker === 'bm25'
        ? scoreBM25(index, queryTerms, topK)
        : scoreTFIDF(index, queryTerms, topK);
    // Filter by phrase clauses (position-aware)
    const filtered = ranked.filter((r) => satisfiesPhrase(clause, r.docId, index));
    const total = filtered.length;
    const pageItems = filtered.slice((page - 1) * limit, page * limit);
    const results = pageItems.map((r) => {
        const meta = index.docs.get(r.docId);
        const text = docTexts.get(r.docId) ?? '';
        const rawTerms = rawQuery.replace(/"/g, '').split(/\s+/).filter(Boolean);
        const snippet = generateSnippet(text, rawTerms);
        return {
            id: r.docId,
            title: meta?.title ?? '',
            url: meta?.url ?? '',
            snippet: snippet.text,
            score: Math.round(r.score * 1000) / 1000,
        };
    });
    return {
        total,
        didYouMean: suggestion ?? undefined,
        results,
    };
}
function satisfiesPhrase(clause, docId, index) {
    switch (clause.type) {
        case 'term':
            return true;
        case 'phrase': {
            const docPositions = new Map();
            for (const term of clause.tokens) {
                const posting = getPostings(index, term).find((p) => p.docId === docId);
                if (posting)
                    docPositions.set(term, posting.positions);
            }
            return phraseMatchesDoc(clause.tokens, docPositions);
        }
        case 'and':
            return clause.clauses.every((c) => satisfiesPhrase(c, docId, index));
        case 'or':
            return clause.clauses.some((c) => satisfiesPhrase(c, docId, index));
        default:
            return true;
    }
}
//# sourceMappingURL=search.js.map