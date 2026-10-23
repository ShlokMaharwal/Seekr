# Algorithm microbenchmarks

Measured 2026-10-23T18:44:37.149Z on Intel(R) Core(TM) i5-3437U CPU @ 1.90GHz, 5.9 GiB RAM, win32 10.0.22621, Node v22.17.0.

Synthetic data, not Wikipedia or live-service throughput. Build before running node bench/micro.mjs. Timings are per operation after warmup, with no performance assertion in CI.

| Trie lookup (10,000 terms, common prefix) |     ms/op |
| ----------------------------------------- | --------: |
| Cached top-6 (5,000 iterations)           |  0.001707 |
| Full traversal (100 iterations)           | 10.316425 |

Measured speedup: 6044.5×.

| Snapshot (500 synthetic documents)            |  Bytes | Decode ms/op (30 iterations) |
| --------------------------------------------- | -----: | ---------------------------: |
| Delta-encoded JSON, including text and fields | 621424 |                       49.111 |
| Binary varint + ordinal/position deltas       | 486592 |                       16.389 |

Both representations contain equivalent documents, title/body postings and snippet text. Includes checksum verification for binary. Disk I/O and API reconciliation are excluded; this isolates the codec. Results depend on CPU and corpus.
