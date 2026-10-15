#!/usr/bin/env node
/**
 * Ranker comparison: BM25 vs TF-IDF
 *
 * Runs 10 sample queries against both rankers and prints the top 5 results
 * side by side as a markdown table.
 *
 * Usage:
 *   node bench/ranker-compare.js [apiUrl]
 */

const API_URL = process.argv[2] ?? 'http://localhost:4000';

const QUERIES = [
  'binary tree traversal',
  'graph shortest path algorithm',
  'machine learning supervised',
  'distributed systems consensus',
  'hash table collision resolution',
  'sorting algorithm comparison',
  'search engine inverted index',
  'operating system process scheduling',
  'compiler lexical analysis tokens',
  'neural network backpropagation',
];

async function query(q, ranker) {
  const r = await fetch(`${API_URL}/search?q=${encodeURIComponent(q)}&ranker=${ranker}&limit=5`);
  if (!r.ok) return [];
  const data = await r.json();
  return data.results ?? [];
}

async function main() {
  console.log(`\n# Ranker Comparison: BM25 vs TF-IDF\n`);
  console.log(`API: ${API_URL}\n`);

  for (const q of QUERIES) {
    console.log(`## Query: "${q}"\n`);
    console.log(`| # | BM25 Title | BM25 Score | TF-IDF Title | TF-IDF Score |`);
    console.log(`|---|------------|------------|--------------|--------------|`);

    const [bm25, tfidf] = await Promise.all([query(q, 'bm25'), query(q, 'tfidf')]);

    const n = Math.max(bm25.length, tfidf.length);
    for (let i = 0; i < n && i < 5; i++) {
      const b = bm25[i];
      const t = tfidf[i];
      const bTitle = b ? b.title.slice(0, 35).replace(/\|/g, '\\|') : '—';
      const tTitle = t ? t.title.slice(0, 35).replace(/\|/g, '\\|') : '—';
      const bScore = b ? b.score : '—';
      const tScore = t ? t.score : '—';
      console.log(`| ${i + 1} | ${bTitle} | ${bScore} | ${tTitle} | ${tScore} |`);
    }
    console.log();
  }
}

main().catch(console.error);
