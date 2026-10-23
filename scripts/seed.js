/**
 * Seed script
 *
 * Starts a crawl via the API with a configurable set of seed URLs.
 * Targets Wikipedia CS articles and Node.js docs for a clean corpus.
 *
 * Usage:
 *   node scripts/seed.js [maxPages] [apiUrl]
 *
 * Defaults:
 *   maxPages = 10000
 *   apiUrl   = http://localhost:4000
 */

const MAX_PAGES = parseInt(process.argv[2] ?? '10000', 10);
const API_URL = process.argv[3] ?? 'http://localhost:4000';

const SEEDS = [
  // Wikipedia CS topic portal and major articles
  'https://en.wikipedia.org/wiki/Computer_science',
  'https://en.wikipedia.org/wiki/Algorithm',
  'https://en.wikipedia.org/wiki/Data_structure',
  'https://en.wikipedia.org/wiki/Search_algorithm',
  'https://en.wikipedia.org/wiki/Sorting_algorithm',
  'https://en.wikipedia.org/wiki/Graph_(discrete_mathematics)',
  'https://en.wikipedia.org/wiki/Tree_(data_structure)',
  'https://en.wikipedia.org/wiki/Hash_table',
  'https://en.wikipedia.org/wiki/Binary_search_tree',
  'https://en.wikipedia.org/wiki/Machine_learning',
  'https://en.wikipedia.org/wiki/Distributed_computing',
  'https://en.wikipedia.org/wiki/Information_retrieval',
  'https://en.wikipedia.org/wiki/Database',
  'https://en.wikipedia.org/wiki/Operating_system',
  'https://en.wikipedia.org/wiki/Compiler',
  'https://en.wikipedia.org/wiki/Network_protocol',
  'https://en.wikipedia.org/wiki/Cryptography',
  // Node.js documentation
  'https://nodejs.org/en/docs/',
];

async function main() {
  console.log(`Seeding Seekr with up to ${MAX_PAGES} pages from ${SEEDS.length} seed URLs`);
  console.log(`API: ${API_URL}`);

  const response = await fetch(`${API_URL}/admin/crawl/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      seeds: SEEDS,
      maxPages: MAX_PAGES,
      delayMs: 500,
      workers: 3,
    }),
  });

  if (!response.ok && response.status !== 204) {
    const text = await response.text();
    console.error(`Failed to start crawl: ${response.status} ${text}`);
    process.exit(1);
  }

  console.log('Crawl started. Monitor at GET /admin/stats and GET /admin/crawl/feed');

  // Poll stats every 10 seconds
  let lastDocs = 0;
  const poll = setInterval(async () => {
    try {
      const r = await fetch(`${API_URL}/admin/stats`);
      const stats = await r.json();
      const delta = stats.docs - lastDocs;
      lastDocs = stats.docs;
      console.log(
        `docs=${stats.docs} terms=${stats.terms} queue=${stats.queueSize}` +
          ` pages/min=${stats.pagesPerMin} (+${delta} since last check)`,
      );
      if (stats.queueSize === 0 && stats.docs > 0) {
        console.log('Queue empty — crawl complete!');
        clearInterval(poll);
      }
    } catch {
      // API not yet ready
    }
  }, 10_000);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
