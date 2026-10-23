# Benchmarks

Measured 2026-10-23T19:26:01.272Z.

Commit: c0ffe53f6b67c3e4b59f19f1f053d5682231fd13 plus any working changes.
Machine: Intel(R) Core(TM) i5-3437U CPU @ 1.90GHz; 5.9 GiB RAM; win32 10.0.22621; Node v22.17.0.

Run `npm run build && npm run bench`. For isolated service measurements run `npm run bench:stack`, then `npm run bench` to merge its artifact. No illustrative numbers are used.

## Index measurements

Corpus: 29 downloaded Wikipedia articles, SHA-256 1a61e708088d5b0bd382a4637ab134e932e9364eb78b4691175b31e7223702f5.

| Measurement                                     |         Value |
| ----------------------------------------------- | ------------: |
| Incremental index heap after corpus load and GC |     7.598 MiB |
| Process RSS (includes runtime and corpus)       |   133.570 MiB |
| Binary snapshot on disk                         | 1107805 bytes |
| Snapshot load, mean of 10 warm-filesystem reads |     56.962 ms |

Heap delta is an estimate affected by GC and allocator behavior, not a byte-exact retained-memory measurement. Raw corpus strings are already resident before the baseline. Snapshot timing includes file reads and checksum verification, and excludes MongoDB reconciliation.

## HTTP search

Reference service run: [GitHub Actions at c0ffe53](https://github.com/ShlokMaharwal/Seekr/actions/runs/40010931478).
The raw decoded benchmark artifact is preserved in `bench/results/fixture-c0ffe53.json`.

Source: Isolated Docker HTTP fixture with real Redis and MongoDB; corpus: 1001 documents. 2026-10-23T19:23:58.834Z AMD EPYC 9V45 96-Core Processor; 15.6 GiB RAM; linux 6.17.0-1022-azure; Node v22.23.4. Service commit: c0ffe53f6b67c3e4b59f19f1f053d5682231fd13.

| Scenario   | Successful req/s | p50 ms | p95 ms | p99 ms | Errors |
| ---------- | ---------------: | -----: | -----: | -----: | -----: |
| BM25 cold  |           589.23 |  7.759 | 13.405 | 23.154 |      0 |
| BM25 warm  |          2891.99 |  1.433 |  3.156 |  5.918 |      0 |
| TFIDF cold |           722.88 |  6.608 |  9.251 | 13.651 |      0 |
| TFIDF warm |          2863.63 |  1.625 |  3.036 |  4.986 |      0 |

Cold requests use unique absent OR terms to guarantee misses without changing matching documents; they include that extra parsing and typo-check cost. Warm requests repeat ten fixed queries after prefill. Scenarios run sequentially, warmup is excluded from elapsed time, response bodies are consumed, and non-200 responses count as errors. Set SEARCH_RATE_LIMIT_MAX=1000000 only on the isolated local benchmark API.

## Crawl throughput

| Workers in one process | HTML pages processed/min | Pages fetched |
| ---------------------- | -----------------------: | ------------: |
| 1                      |                  2081.06 |           184 |
| 3                      |                  5754.37 |           499 |

The isolated fixture adds 20 ms response latency, uses zero domain delay, and prewarms MongoDB so both crawl runs encounter the same stored corpus. It counts fetched HTML including content duplicates, excludes robots skips and failures, and includes stop/drain time. This measures worker concurrency, not three independent crawler processes or Internet crawl throughput.

## Ranking comparison

| Query                 | Ranker | Top five titles (score)                                                                                                                      |
| --------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| binary tree           | bm25   | Computer science 1 (0.001); Computer science 0 (0.001); Computer science 3 (0.001); Computer science 2 (0.001); Computer science 999 (0.001) |
| binary tree           | tfidf  | Computer science 1 (2); Computer science 0 (2); Computer science 3 (2); Computer science 2 (2); Computer science 999 (2)                     |
| graph algorithm       | bm25   | Computer science 1 (0.001); Computer science 0 (0.001); Computer science 3 (0.001); Computer science 2 (0.001); Computer science 999 (0.001) |
| graph algorithm       | tfidf  | Computer science 1 (2.693); Computer science 0 (2.693); Computer science 3 (2.693); Computer science 2 (2.693); Computer science 999 (2.693) |
| search engine         | bm25   | Computer science 1 (0.001); Computer science 0 (0.001); Computer science 3 (0.001); Computer science 2 (0.001); Computer science 999 (0.001) |
| search engine         | tfidf  | Computer science 1 (2); Computer science 0 (2); Computer science 3 (2); Computer science 2 (2); Computer science 999 (2)                     |
| machine learning      | bm25   | Computer science 1 (0.001); Computer science 0 (0.001); Computer science 3 (0.001); Computer science 2 (0.001); Computer science 999 (0.001) |
| machine learning      | tfidf  | Computer science 1 (2); Computer science 0 (2); Computer science 3 (2); Computer science 2 (2); Computer science 999 (2)                     |
| data structure        | bm25   | Computer science 1 (0.001); Computer science 0 (0.001); Computer science 3 (0.001); Computer science 2 (0.001); Computer science 999 (0.001) |
| data structure        | tfidf  | Computer science 1 (2); Computer science 0 (2); Computer science 3 (2); Computer science 2 (2); Computer science 999 (2)                     |
| distributed computing | bm25   | Computer science 1 (0.001); Computer science 0 (0.001); Computer science 3 (0.001); Computer science 2 (0.001); Computer science 999 (0.001) |
| distributed computing | tfidf  | Computer science 1 (2); Computer science 0 (2); Computer science 3 (2); Computer science 2 (2); Computer science 999 (2)                     |
| hash table            | bm25   | Computer science 1 (0.001); Computer science 0 (0.001); Computer science 3 (0.001); Computer science 2 (0.001); Computer science 999 (0.001) |
| hash table            | tfidf  | Computer science 1 (2); Computer science 0 (2); Computer science 3 (2); Computer science 2 (2); Computer science 999 (2)                     |
| sorting algorithm     | bm25   | Computer science 1 (0.001); Computer science 0 (0.001); Computer science 3 (0.001); Computer science 2 (0.001); Computer science 999 (0.001) |
| sorting algorithm     | tfidf  | Computer science 1 (2.693); Computer science 0 (2.693); Computer science 3 (2.693); Computer science 2 (2.693); Computer science 999 (2.693) |
| information retrieval | bm25   | Computer science 1 (0.001); Computer science 0 (0.001); Computer science 3 (0.001); Computer science 2 (0.001); Computer science 999 (0.001) |
| information retrieval | tfidf  | Computer science 1 (2); Computer science 0 (2); Computer science 3 (2); Computer science 2 (2); Computer science 999 (2)                     |
| database transaction  | bm25   | Computer science 1 (0.001); Computer science 0 (0.001); Computer science 3 (0.001); Computer science 2 (0.001); Computer science 999 (0.001) |
| database transaction  | tfidf  | Computer science 1 (2); Computer science 0 (2); Computer science 3 (2); Computer science 2 (2); Computer science 999 (2)                     |

Algorithm-only autocomplete and equivalent JSON/binary codec comparisons are measured separately in [MICROBENCHMARKS.md](MICROBENCHMARKS.md). These are synthetic microbenchmarks, not service throughput.
