import { queryOptions } from '@tanstack/react-query';
import { API_BASE_URL, USE_MOCK, PAGE_SIZE } from './config';
export type Ranker = 'bm25' | 'tfidf';
export type SearchResult = { id: string; title: string; url: string; snippet: string; score: number };
export type SearchResponse = { total: number; tookMs: number; didYouMean?: string; results: SearchResult[] };
export type DocumentData = { id: string; title: string; url: string; text: string; crawledAt: string; wordCount: number };
export type Stats = { docs: number; terms: number; indexSizeMb: number; pagesPerMin: number; queueSize: number; duplicates: number; failures: number };
export type FeedItem = { url: string; status: 'success' | 'failed' | 'duplicate' | 'skipped'; ts: string };
export type Metrics = { latency: { ts: string; p50: number; p99: number }[]; crawlRate: { ts: string; count: number }[]; topQueries: { q: string; count: number }[] };
export type CrawlSettings = { seeds: string[]; maxPages: number; delayMs: number; workers: number };
const topics = ['Binary tree', 'Graph algorithms', 'Distributed systems', 'Machine learning', 'Data structures', 'Search engines', 'TypeScript', 'React', 'System design', 'Vector databases'];
const sources = [ ['Wikipedia', 'en.wikipedia.org'], ['GeeksforGeeks', 'geeksforgeeks.org'], ['MIT OpenCourseWare', 'ocw.mit.edu'], ['Stanford University', 'cs.stanford.edu'] ];
export const documents: DocumentData[] = topics.flatMap((topic, t) => sources.map(([source, domain], i) => {
 const text = `${topic} is a foundational concept in computer science. This guide explores ${topic.toLowerCase()} through practical examples, core principles, and real-world applications.\n\nOverview\n\nUnderstanding ${topic.toLowerCase()} starts with the fundamentals. We examine how the underlying structure works, compare common approaches, and discuss the trade-offs that influence implementation decisions.\n\nImplementation and complexity\n\nEfficient implementations balance time complexity with memory usage. The examples below outline a step-by-step approach to designing reliable systems. Each operation is analyzed to help you select the right technique for your use case.\n\nFurther reading\n\nExplore related algorithms, data structures, and distributed systems to build a deeper understanding. This resource includes references and exercises for continued study.`;
 return {id: `${t * 4 + i + 1}`, title: `${topic}${[' — Overview and fundamentals', ' explained with examples', ' — Lecture notes', ': a practical guide'][i]}`, url: `https://${domain}/${topic.toLowerCase().replaceAll(' ', '-')}`, text, crawledAt:'2026-10-13T17:32:00Z', wordCount:text.split(/\s+/).length};
}));
let crawlState: 'running' | 'paused' | 'stopped' = 'stopped';
let crawlStartedAt = 0;
const wait = () => new Promise(resolve => setTimeout(resolve, 220));

// ---------------------------------------------------------------------------
// Admin token management (localStorage with try/catch for restricted contexts)
// ---------------------------------------------------------------------------

const ADMIN_TOKEN_KEY = 'seekr_admin_token';

/** Get the stored admin token, or empty string if not set or storage is blocked. */
export function getAdminToken(): string {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

/** Store the admin token. Silently fails in restricted storage contexts. */
export function setAdminToken(token: string): void {
  try {
    if (token) {
      localStorage.setItem(ADMIN_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
    }
  } catch {
    // Storage restricted (e.g. incognito, iframe sandbox) — token kept in memory only
  }
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, body === undefined ? undefined : { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
  if (!response.ok) throw new Error(`Request failed (${response.status}). Please try again.`);
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return text ? JSON.parse(text) as T : undefined as T;
}

/** Make a request to an admin endpoint, including the Bearer token if set. */
async function adminRequest<T>(path: string, body?: unknown): Promise<T> {
  const token = getAdminToken();
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: body !== undefined ? 'POST' : 'GET',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Authentication failed. Check your admin token in settings.');
    }
    throw new Error(`Request failed (${response.status}). Please try again.`);
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return text ? JSON.parse(text) as T : undefined as T;
}

export function mockSearch(q: string, page: number, ranker: Ranker): SearchResponse {
 const corrected = q.toLowerCase().replace('binry', 'binary').replace('algoritms', 'algorithms');
 const phrase = corrected.match(/"([^"]+)"/);
 const words = corrected.replaceAll('"', '').toLowerCase().split(/\s+/).filter(Boolean);
 const matches = documents.filter(d => phrase ? d.text.toLowerCase().includes((phrase[1] ?? '').toLowerCase()) : words.every(w => `${d.title} ${d.text}`.toLowerCase().includes(w)));
 const sorted = ranker === 'tfidf' ? [...matches].sort((a,b) => Number(b.id) - Number(a.id)) : matches;
 return {total:matches.length, tookMs:ranker === 'bm25' ? 12 : 9, ...(corrected !== q.toLowerCase() ? {didYouMean:corrected} : {}), results:sorted.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE).map((d,i) => ({id:d.id,title:d.title,url:d.url,snippet:d.text.slice(0,245),score:Number((ranker === 'bm25' ? 9.82-i*.37 : .94-i*.031).toFixed(3))}))};
}
export const api = {
 async search(q:string,page=1,ranker:Ranker='bm25'):Promise<SearchResponse> { if(!USE_MOCK) return request(`/search?${new URLSearchParams({q,page:String(page),limit:String(PAGE_SIZE),ranker})}`); await wait(); return mockSearch(q,page,ranker); },
 async autocomplete(q:string):Promise<{suggestions:string[]}> {if(!USE_MOCK) return request(`/autocomplete?${new URLSearchParams({q})}`); return {suggestions:topics.filter(t=>t.toLowerCase().includes(q.toLowerCase())).slice(0,6).map(t=>t.toLowerCase())};},
 async document(id:string):Promise<DocumentData> {if(!USE_MOCK)return request(`/doc/${encodeURIComponent(id)}`); await wait(); const doc=documents.find(d=>d.id===id); if(!doc)throw new Error('This document is not in the index.'); return doc;},
 async stats():Promise<Stats> {if(!USE_MOCK)return adminRequest('/admin/stats'); const progress=crawlState==='running'?Math.floor((Date.now()-crawlStartedAt)/2000):0; return {docs:24862+progress, terms:186429,indexSizeMb:142.8,pagesPerMin:crawlState==='running'?48:0,queueSize:Math.max(0,1240-progress),duplicates:382,failures:24};},
 async feed():Promise<FeedItem[]> {if(!USE_MOCK)return adminRequest('/admin/crawl/feed'); const offset=crawlState==='running'?Math.floor((Date.now()-crawlStartedAt)/2000):0; return documents.slice(offset%30,offset%30+7).map((d,i)=>({url:d.url,status:(['success','success','duplicate','success','failed','skipped','success'] as const)[i] ?? 'success',ts:new Date(Date.UTC(2026,9,13,18,32,0)+offset*2000-i*12000).toISOString()}));},
 async metrics():Promise<Metrics> {if(!USE_MOCK)return adminRequest('/admin/metrics'); return {latency:Array.from({length:12},(_,i)=>({ts:`${String(14+Math.floor(i/3)).padStart(2,'0')}:${String(i%3*20).padStart(2,'0')}`,p50:[12,14,11,16,12,10,15,13,11,12,9,12][i] ?? 12,p99:[34,38,31,42,36,30,39,35,29,33,31,34][i] ?? 34})),crawlRate:Array.from({length:12},(_,i)=>({ts:`${14+Math.floor(i/3)}:${String(i%3*20).padStart(2,'0')}`,count:[24,32,28,44,38,42,34,48,40,56,46,48][i] ?? 48})),topQueries:topics.map((q,i)=>({q:q.toLowerCase(),count:1240-i*109}))};},
 async start(settings:CrawlSettings) {if(!USE_MOCK)return adminRequest<void>('/admin/crawl/start',settings); crawlState='running';crawlStartedAt=Date.now();},
 async pause() {if(!USE_MOCK)return adminRequest<void>('/admin/crawl/pause',{});crawlState='paused';},
 async stop() {if(!USE_MOCK)return adminRequest<void>('/admin/crawl/stop',{});crawlState='stopped';},
};
export const searchOptions=(q:string,page:number,ranker:Ranker)=>queryOptions({queryKey:['search',q,page,ranker],queryFn:()=>api.search(q,page,ranker)});
export const statsOptions=queryOptions({queryKey:['stats'],queryFn:api.stats,refetchInterval:2000});
export const feedOptions=queryOptions({queryKey:['feed'],queryFn:api.feed,refetchInterval:2000});
export const metricsOptions=queryOptions({queryKey:['metrics'],queryFn:api.metrics,refetchInterval:2000});
export const docOptions=(id:string)=>queryOptions({queryKey:['doc',id],queryFn:()=>api.document(id)});
