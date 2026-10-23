# Benchmarks

Measured 2026-10-23T19:17:08.399Z.

Commit: 4840177ad49306f72e058524243e77834bd0622c plus any working changes.
Machine: Intel(R) Core(TM) i5-3437U CPU @ 1.90GHz; 5.9 GiB RAM; win32 10.0.22621; Node v22.17.0.

Run `npm run build && npm run bench`. For isolated service measurements run `npm run bench:stack`, then `npm run bench` to merge its artifact. No illustrative numbers are used.

## Index measurements

Corpus: 29 downloaded Wikipedia articles, SHA-256 1a61e708088d5b0bd382a4637ab134e932e9364eb78b4691175b31e7223702f5.

| Measurement                                     |         Value |
| ----------------------------------------------- | ------------: |
| Incremental index heap after corpus load and GC |     7.598 MiB |
| Process RSS (includes runtime and corpus)       |   136.414 MiB |
| Binary snapshot on disk                         | 1107805 bytes |
| Snapshot load, mean of 10 warm-filesystem reads |     48.745 ms |

Heap delta is an estimate affected by GC and allocator behavior, not a byte-exact retained-memory measurement. Raw corpus strings are already resident before the baseline. Snapshot timing includes file reads and checksum verification, and excludes MongoDB reconciliation.

## HTTP search

TBD (run locally): fetch failed.

| Scenario   |  Successful req/s |            p50 ms |            p95 ms |            p99 ms |            Errors |
| ---------- | ----------------: | ----------------: | ----------------: | ----------------: | ----------------: |
| BM25 cold  | TBD (run locally) | TBD (run locally) | TBD (run locally) | TBD (run locally) | TBD (run locally) |
| BM25 warm  | TBD (run locally) | TBD (run locally) | TBD (run locally) | TBD (run locally) | TBD (run locally) |
| TFIDF cold | TBD (run locally) | TBD (run locally) | TBD (run locally) | TBD (run locally) | TBD (run locally) |
| TFIDF warm | TBD (run locally) | TBD (run locally) | TBD (run locally) | TBD (run locally) | TBD (run locally) |

Cold requests use unique absent OR terms to guarantee misses without changing matching documents; they include that extra parsing and typo-check cost. Warm requests repeat ten fixed queries after prefill. Scenarios run sequentially, warmup is excluded from elapsed time, response bodies are consumed, and non-200 responses count as errors. Set SEARCH_RATE_LIMIT_MAX=1000000 only on the isolated local benchmark API.

## Crawl throughput

| Workers in one process | HTML pages processed/min |     Pages fetched |
| ---------------------- | -----------------------: | ----------------: |
| 1                      |        TBD (run locally) | TBD (run locally) |
| 3                      |        TBD (run locally) | TBD (run locally) |

The isolated fixture adds 20 ms response latency, uses zero domain delay, and prewarms MongoDB so both crawl runs encounter the same stored corpus. It counts fetched HTML including content duplicates, excludes robots skips and failures, and includes stop/drain time. This measures worker concurrency, not three independent crawler processes or Internet crawl throughput.

## Ranking comparison

TBD (run locally). Real Wikipedia relevance metrics are in [EVALUATION.md](EVALUATION.md).

Algorithm-only autocomplete and equivalent JSON/binary codec comparisons are measured separately in [MICROBENCHMARKS.md](MICROBENCHMARKS.md). These are synthetic microbenchmarks, not service throughput.
