# Relevance evaluation

Measured 2026-10-23T18:46:23.888Z from commit 5e429544b44022e25617029143ac5555ddafc023 (plus any working changes).

Corpus: 29 real articles; 20 manually authored judgments. SHA-256: 1a61e708088d5b0bd382a4637ab134e932e9364eb78b4691175b31e7223702f5.

Grades: 3 = direct answer/topic, 2 = closely related explanation, 1 = background; unjudged URLs score 0. This is a small, incomplete educational judgment pool, not an independent benchmark. P@10 always divides by 10; MRR uses the first positive grade; nDCG uses exponential gain. All queries use the engine's AND semantics. The same queries select and assess parameters, so these are exploratory results, not a held-out evaluation.

| Configuration | P@10 | MRR@10 | nDCG@10 |
|---|---:|---:|---:|
| TF-IDF | 0.2500 | 0.9750 | 0.9089 |
| BM25 k1=0.6 b=0.25 title=0 | 0.2500 | 1.0000 | 0.9630 |
| BM25F k1=0.6 b=0.25 title=1 | 0.2500 | 1.0000 | 0.9630 |
| BM25F k1=0.6 b=0.25 title=2 | 0.2500 | 1.0000 | 0.9630 |
| BM25F k1=0.6 b=0.25 title=4 | 0.2500 | 1.0000 | 0.9630 |
| BM25 k1=0.6 b=0.75 title=0 | 0.2500 | 1.0000 | 0.9683 |
| BM25F k1=0.6 b=0.75 title=1 | 0.2500 | 1.0000 | 0.9683 |
| BM25F k1=0.6 b=0.75 title=2 | 0.2500 | 1.0000 | 0.9683 |
| BM25F k1=0.6 b=0.75 title=4 | 0.2500 | 1.0000 | 0.9683 |
| BM25 k1=0.6 b=1 title=0 | 0.2500 | 1.0000 | 0.9710 |
| BM25F k1=0.6 b=1 title=1 | 0.2500 | 1.0000 | 0.9710 |
| BM25F k1=0.6 b=1 title=2 | 0.2500 | 1.0000 | 0.9710 |
| BM25F k1=0.6 b=1 title=4 | 0.2500 | 1.0000 | 0.9710 |
| BM25 k1=1.2 b=0.25 title=0 | 0.2500 | 1.0000 | 0.9617 |
| BM25F k1=1.2 b=0.25 title=1 | 0.2500 | 1.0000 | 0.9617 |
| BM25F k1=1.2 b=0.25 title=2 | 0.2500 | 1.0000 | 0.9617 |
| BM25F k1=1.2 b=0.25 title=4 | 0.2500 | 1.0000 | 0.9617 |
| BM25 k1=1.2 b=0.75 title=0 | 0.2500 | 1.0000 | 0.9683 |
| BM25F k1=1.2 b=0.75 title=1 | 0.2500 | 1.0000 | 0.9683 |
| BM25F k1=1.2 b=0.75 title=2 | 0.2500 | 1.0000 | 0.9683 |
| BM25F k1=1.2 b=0.75 title=4 | 0.2500 | 1.0000 | 0.9683 |
| BM25 k1=1.2 b=1 title=0 | 0.2500 | 1.0000 | 0.9710 |
| BM25F k1=1.2 b=1 title=1 | 0.2500 | 1.0000 | 0.9710 |
| BM25F k1=1.2 b=1 title=2 | 0.2500 | 1.0000 | 0.9710 |
| BM25F k1=1.2 b=1 title=4 | 0.2500 | 1.0000 | 0.9710 |
| BM25 k1=1.8 b=0.25 title=0 | 0.2500 | 1.0000 | 0.9617 |
| BM25F k1=1.8 b=0.25 title=1 | 0.2500 | 1.0000 | 0.9617 |
| BM25F k1=1.8 b=0.25 title=2 | 0.2500 | 1.0000 | 0.9617 |
| BM25F k1=1.8 b=0.25 title=4 | 0.2500 | 1.0000 | 0.9617 |
| BM25 k1=1.8 b=0.75 title=0 | 0.2500 | 1.0000 | 0.9683 |
| BM25F k1=1.8 b=0.75 title=1 | 0.2500 | 1.0000 | 0.9683 |
| BM25F k1=1.8 b=0.75 title=2 | 0.2500 | 1.0000 | 0.9683 |
| BM25F k1=1.8 b=0.75 title=4 | 0.2500 | 1.0000 | 0.9683 |
| BM25 k1=1.8 b=1 title=0 | 0.2500 | 1.0000 | 0.9710 |
| BM25F k1=1.8 b=1 title=1 | 0.2500 | 1.0000 | 0.9710 |
| BM25F k1=1.8 b=1 title=2 | 0.2500 | 1.0000 | 0.9710 |
| BM25F k1=1.8 b=1 title=4 | 0.2500 | 1.0000 | 0.9710 |

Title weight 2 changes nDCG@10 by 0.0000 versus default body BM25. The default remains body BM25 (title weight 0); set BM25_TITLE_WEIGHT to opt into BM25F.

Reproduce: npm run build; node bench/eval/prepare.mjs; node bench/eval/run.mjs. Downloaded text retains source URLs and retrieval timestamps under ignored data/eval/. Wikipedia text is CC BY-SA.
