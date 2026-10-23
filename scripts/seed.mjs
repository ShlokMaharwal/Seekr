import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

export const SEEDS = [
  'Computer_science',
  'Algorithm',
  'Data_structure',
  'Search_algorithm',
  'Sorting_algorithm',
  'Graph_(discrete_mathematics)',
  'Tree_(data_structure)',
  'Hash_table',
  'Binary_search_tree',
  'Machine_learning',
  'Distributed_computing',
  'Information_retrieval',
  'Database',
].map((title) => `https://en.wikipedia.org/wiki/${title}`);
SEEDS.push('https://nodejs.org/en/docs/');

export function parseSeedArgs(args, env = process.env) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      local: { type: 'boolean', default: false },
      'max-pages': { type: 'string' },
      url: { type: 'string' },
      workers: { type: 'string' },
      'delay-ms': { type: 'string' },
      watch: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });
  function integer(value, min, max, label) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < min || number > max)
      throw new Error(`${label} must be ${min}..${max}`);
    return number;
  }
  const apiUrl = new URL(
    values.url ??
      positionals[1] ??
      (values.local ? 'http://localhost:4000' : (env.SEEKR_API_URL ?? 'http://localhost:4001')),
  );
  if (!['http:', 'https:'].includes(apiUrl.protocol) || apiUrl.username || apiUrl.password)
    throw new Error('API URL must use HTTP(S) without credentials');
  return {
    apiUrl: apiUrl.href.replace(/\/$/, ''),
    maxPages: integer(values['max-pages'] ?? positionals[0] ?? 1000, 1, 1_000_000, 'max-pages'),
    workers: integer(values.workers ?? 3, 1, 10, 'workers'),
    delayMs: integer(values['delay-ms'] ?? 500, 0, 60_000, 'delay-ms'),
    watch: values.watch,
    help: values.help,
  };
}
export async function main(args = process.argv.slice(2)) {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const config = parseSeedArgs(args);
  if (config.help) {
    console.log(
      'Usage: npm run seed -- [--local] [--max-pages 1000] [--workers 3] [--delay-ms 500] [--url http://localhost:4001] [--watch]\nLegacy: node scripts/seed.js [maxPages] [apiUrl]\nADMIN_TOKEN is read from the environment or root .env. Docker is the default target.',
    );
    return;
  }
  const headers = {
    'Content-Type': 'application/json',
    ...(process.env.ADMIN_TOKEN ? { Authorization: `Bearer ${process.env.ADMIN_TOKEN}` } : {}),
  };
  const response = await fetch(`${config.apiUrl}/admin/crawl/start`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      seeds: SEEDS,
      maxPages: config.maxPages,
      delayMs: config.delayMs,
      workers: config.workers,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status !== 204)
    throw new Error(
      `Cannot start crawl: HTTP ${response.status}. Check the API address and ADMIN_TOKEN.`,
    );
  console.log(
    `Crawl requested at ${config.apiUrl}: up to ${config.maxPages} URL attempts, ${config.workers} workers. Monitor the dashboard.`,
  );
  if (config.watch)
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const result = await fetch(`${config.apiUrl}/admin/stats`, {
        headers,
        signal: AbortSignal.timeout(10_000),
      });
      if (!result.ok) throw new Error(`Stats HTTP ${result.status}`);
      const stats = await result.json();
      console.log(
        `documents=${stats.docs} terms=${stats.terms} queued=${stats.queueSize} pages/min=${stats.pagesPerMin}`,
      );
    }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
