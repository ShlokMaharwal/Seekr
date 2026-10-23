import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { QUERIES } from './search-bench.js';
export async function compareRankers(apiUrl = 'http://localhost:4001') {
  const lines = ['| Query | Ranker | Top five titles (score) |', '|---|---|---|'];
  for (const q of QUERIES)
    for (const ranker of ['bm25', 'tfidf']) {
      const response = await fetch(
        `${apiUrl}/search?${new URLSearchParams({ q, ranker, limit: '5' })}`,
        { signal: AbortSignal.timeout(10_000) },
      );
      if (!response.ok) throw new Error(`Ranker comparison: HTTP ${response.status}`);
      const data = await response.json();
      lines.push(
        `| ${q} | ${ranker} | ${data.results.map((r) => `${r.title.replaceAll('|', '/')} (${r.score})`).join('; ')} |`,
      );
    }
  return lines.join('\n');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  console.log(await compareRankers(process.argv[2]));
