# Design decisions

## BM25, TF-IDF, and field boosts

BM25 defaults to `k1=1.2`, `b=0.75`: frequency saturates and body length is normalized.
Its smoothed IDF remains nonnegative. TF-IDF uses logarithmic frequency and smoothed
IDF, without length normalization. Both have tests with hand-calculated scores.

BM25F normalizes title and body frequencies separately, weights the title, adds
that evidence, then saturates once. Document frequency is the union across enabled
fields. Weight zero reduces to body BM25, which a regression test verifies.
The small [Wikipedia evaluation](EVALUATION.md) found no title-boost gain, so the
default stays zero. The parameter sweep is exploratory and uses the same judgments
for comparison and selection; it is not a held-out performance claim.

## Positional postings

Each field maps terms to `{ docId, tf, positions[] }`. Positions increase across
removed stopwords, making phrase gaps meaningful. Keeping positions costs memory;
the cost depends on corpus frequencies and is not assigned a universal multiplier.
It avoids rescanning every document for ordinary phrase-position checks. Removed
stopword identity is not indexed, so equal-sized stopword gaps cannot distinguish
which stopword occurred. Snippets independently scan raw text for their best window.

AND and OR are evaluated as sets before ranking. Phrase verification uses a map
of term/document positions. Exact match totals come from the full candidate set;
the heap is only responsible for returning the requested highest-scoring page.

## Bigram filtering and capped edit distance

The character-bigram index includes boundary markers to help short/edge typos.
Candidate terms share at least one bigram, and optimal-string-alignment
Damerau-Levenshtein verifies distance at most two. It supports adjacent swaps and
uses rolling rows. This is a filter, not an exhaustive guarantee for every short
misspelling with no common bigram. Suggestions are generated per zero-hit stem and
shown to the user; successful terms are preserved.

## Cached autocomplete

Each prefix node caches ten terminal-node references ordered by frequency.
Since frequencies only increase, updating the changed terminal plus the cached
winners suffices along its ancestor path. The public top-six query walks the
prefix and slices its winners. Requests above cache capacity use full traversal.
Mutation cost and memory increase in exchange for cheaper repeated prefix reads.
[MICROBENCHMARKS.md](MICROBENCHMARKS.md) compares both paths on synthetic data and
checks they return identical suggestions; timing is not asserted in tests.

## Exact and near duplicates

SHA-256 hashes all normalized text. SimHash projects token frequencies onto 64 bits
using stable per-term hashes; Hamming distance estimates similarity. Four 16-bit
bands select Mongo candidates: with distance at most three, at least one band
must match. The band query excludes the same URL so content updates remain possible.
Short pages bypass near-duplicate filtering. This is heuristic suppression, and
concurrent checks/upserts across different URLs are not a global transaction.

## Stream decoupling and at-least-once delivery

Redis buffers crawler output independently of indexing. Pending-entry recovery
and atomic frontier leases preserve recoverable work after crashes. The API applies
documents idempotently, replacing postings and maintaining corpus statistics.
Mongo writes and Redis events are not one transaction, so startup reconciliation
also covers a publication or acknowledgement/snapshot gap. Exactly-once delivery
is not claimed. Multiple API instances would need broadcast or sharded streams.

## Cache TTL and metrics

Query keys combine ranker, page, limit, and a SHA-256 digest of the full query.
This avoids punctuation/truncation collisions. A 60-second TTL trades freshness
for cheaper repeated queries; index changes do not invalidate those entries.
Cache and metric failures are caught around the already-loaded search index.
Latency is recorded for uncached execution, while top-query counts include hits.
Crawl timestamps and counts occupy separate data structures rather than trying
to use one Redis score for both. Top queries are cumulative, not a 24-hour window.

## Binary snapshots and legacy support

Sorted external IDs get compact internal ordinals. Posting ordinal gaps and
position gaps use varints; strings are length-prefixed UTF-8. The checksum detects
partial writes and damaged payloads. Writers fsync unique temp files then rename;
legacy delta-encoded JSON is still accepted and validated. Full snippet text is
included so a restart does not produce empty excerpts. Reconciliation can reuse
unchanged text instead of re-tokenizing the full corpus.

The binary/JSON comparison uses equivalent content, including fields and text.
It does not compare a text-bearing binary snapshot against a smaller feature set
in old JSON. Actual sizes and decode timings are recorded, not assumed.

## What would change at 10 million documents

| Current choice                          | Larger-system direction                                                            |
| --------------------------------------- | ---------------------------------------------------------------------------------- |
| Mutable index and text in one API's RAM | Shard by document ID; use immutable disk segments and bounded text caches          |
| Whole-index snapshots                   | Incremental segment commits, checksummed manifests, and compaction                 |
| One event consumer group                | Partition streams by shard or broadcast to independent replica groups              |
| One-process ranking                     | Scatter-gather shard queries, merge top-K with a heap, and apply global statistics |
| Corpus reconciliation at startup        | Durable checkpoints and incremental change logs                                    |
| Single Redis query cache                | Per-process LRU plus distributed cache with versioned invalidation                 |

These are design directions, not implemented scale claims. The project measures
small local/Wikipedia corpora and an isolated generated fixture.
