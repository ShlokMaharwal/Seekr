import { readFile, mkdir, writeFile } from 'node:fs/promises';
const judgments = JSON.parse(await readFile(new URL('./judgments.json', import.meta.url), 'utf8'));
const titles = [...new Set(judgments.flatMap((j) => Object.keys(j.grades)))];
const documents = [];
for (const title of titles) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    prop: 'extracts',
    explaintext: '1',
    redirects: '1',
    titles: decodeURIComponent(title).replaceAll('_', ' '),
  });
  const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
    headers: { 'User-Agent': 'SeekrEvaluation/1.0 (https://github.com/ShlokMaharwal/Seekr)' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok)
    throw new Error(`Wikipedia ${response.status}; no evaluation numbers were generated`);
  const data = await response.json();
  const page = Object.values(data.query?.pages ?? {})[0];
  if (!page?.extract) throw new Error(`Missing article: ${title}`);
  documents.push({
    id: title,
    url: `https://en.wikipedia.org/wiki/${title}`,
    title: page.title,
    text: page.extract,
    revisionSource: response.url,
    retrievedAt: new Date().toISOString(),
  });
  console.log(`Downloaded ${documents.length}/${titles.length}: ${page.title}`);
  await new Promise((resolve) => setTimeout(resolve, 250));
}
await mkdir('data/eval', { recursive: true });
await writeFile('data/eval/corpus.json', JSON.stringify(documents));
console.log(
  'Saved data/eval/corpus.json. Wikipedia text is CC BY-SA; URLs and retrieval times are retained.',
);
