import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  createIndex,
  addDocument,
  buildBigramIndex,
  search,
} from '../../packages/core/dist/index.js';
import { metrics } from './metrics.mjs';

const judgments = JSON.parse(await readFile(new URL('./judgments.json', import.meta.url), 'utf8'));
const corpusPath = process.argv[2] ?? 'data/eval/corpus.json';
let raw;
try {
  raw = await readFile(corpusPath);
} catch {
  console.error(
    'No corpus. Run node bench/eval/prepare.mjs or export real crawled documents to data/eval/corpus.json.',
  );
  process.exit(1);
}
const documents = JSON.parse(raw);
const index = createIndex();
const texts = new Map();
for (const doc of documents) {
  addDocument(index, doc.id, doc.text, doc.title, doc.url);
  texts.set(doc.id, doc.text);
}
const bigrams = buildBigramIndex(index.postings.keys());
const configurations = [{ name: 'TF-IDF', ranker: 'tfidf', bm25: {} }];
for (const k1 of [0.6, 1.2, 1.8])
  for (const b of [0.25, 0.75, 1])
    for (const titleWeight of [0, 1, 2, 4]) {
      configurations.push({
        name: `BM25${titleWeight ? 'F' : ''} k1=${k1} b=${b} title=${titleWeight}`,
        ranker: 'bm25',
        bm25: { k1, b, titleWeight },
      });
    }
const rows = configurations.map((config) => {
  let precision = 0,
    mrr = 0,
    ndcg = 0;
  for (const judgment of judgments) {
    const grades = Object.fromEntries(
      Object.entries(judgment.grades).map(([slug, grade]) => [
        `https://en.wikipedia.org/wiki/${slug}`,
        grade,
      ]),
    );
    const ids = search(index, judgment.q, texts, bigrams, {
      ranker: config.ranker,
      bm25: config.bm25,
      limit: 10,
      snippets: false,
    }).results.map((r) => index.docs.get(r.docId).url);
    const result = metrics(ids, grades);
    precision += result.precision;
    mrr += result.mrr;
    ndcg += result.ndcg;
  }
  return {
    name: config.name,
    precision: precision / judgments.length,
    mrr: mrr / judgments.length,
    ndcg: ndcg / judgments.length,
  };
});
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const baseline = rows.find((r) => r.name === 'BM25 k1=1.2 b=0.75 title=0');
const field = rows.find((r) => r.name === 'BM25F k1=1.2 b=0.75 title=2');
const content = `# Relevance evaluation\n\nMeasured ${new Date().toISOString()} from commit ${sha} (plus any working changes).\n\nCorpus: ${index.N} real articles; ${judgments.length} manually authored judgments. SHA-256: ${createHash('sha256').update(raw).digest('hex')}.\n\nGrades: 3 = direct answer/topic, 2 = closely related explanation, 1 = background; unjudged URLs score 0. This is a small, incomplete educational judgment pool, not an independent benchmark. P@10 always divides by 10; MRR uses the first positive grade; nDCG uses exponential gain. All queries use the engine's AND semantics. The same queries select and assess parameters, so these are exploratory results, not a held-out evaluation.\n\n| Configuration | P@10 | MRR@10 | nDCG@10 |\n|---|---:|---:|---:|\n${rows.map((r) => `| ${r.name} | ${r.precision.toFixed(4)} | ${r.mrr.toFixed(4)} | ${r.ndcg.toFixed(4)} |`).join('\n')}\n\nTitle weight 2 changes nDCG@10 by ${(field.ndcg - baseline.ndcg).toFixed(4)} versus default body BM25. The default remains body BM25 (title weight 0); set BM25_TITLE_WEIGHT to opt into BM25F.\n\nReproduce: npm run build; node bench/eval/prepare.mjs; node bench/eval/run.mjs. Downloaded text retains source URLs and retrieval timestamps under ignored data/eval/. Wikipedia text is CC BY-SA.\n`;
await mkdir('docs', { recursive: true });
await writeFile('docs/EVALUATION.md', content);
console.log(content);
