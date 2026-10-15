import { describe, expect, it } from 'vitest';
import { documents, mockSearch } from '@/frontend/api';
import { API_BASE_URL, PAGE_SIZE, USE_MOCK } from '@/frontend/config';
import { validateCrawl } from '@/frontend/dashboard';
describe('Seekr API rules',()=>{
 it('uses the requested local REST endpoint with mock data enabled',()=>{expect(API_BASE_URL).toBe('http://localhost:4000');expect(USE_MOCK).toBe(true)});
 it('returns ten results per page with nonoverlapping pages',()=>{expect(PAGE_SIZE).toBe(10);const one=mockSearch('computer science',1,'bm25');const two=mockSearch('computer science',2,'bm25');expect(one.results).toHaveLength(10);expect(two.results).toHaveLength(10);expect(one.total).toBe(documents.length);expect(one.results.map(r=>r.id).some(id=>two.results.some(r=>r.id===id))).toBe(false)});
 it('supports exact quoted phrase matching',()=>{expect(mockSearch('"binary tree"',1,'bm25').results).toHaveLength(4);expect(mockSearch('"tree binary"',1,'bm25').total).toBe(0)});
 it('uses distinct BM25 and TF-IDF ranking orders',()=>{const a=mockSearch('binary tree',1,'bm25');const b=mockSearch('binary tree',1,'tfidf');expect(a.results[0]?.id).toBe('1');expect(b.results[0]?.id).toBe('4');expect(a.results[0]?.score).not.toBe(b.results[0]?.score)});
 it('returns spelling suggestions',()=>{expect(mockSearch('binry tree',1,'bm25').didYouMean).toBe('binary tree')});
 it('rejects invalid seed URLs before starting the crawler',()=>{expect(validateCrawl({seeds:['javascript:alert(1)'],maxPages:100,delayMs:1000,workers:4})).toBe('Seed URLs must start with http:// or https://.');expect(validateCrawl({seeds:['https://example.com'],maxPages:100,delayMs:1000,workers:4})).toBeNull()});
});
