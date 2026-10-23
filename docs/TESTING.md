# Verification

Coverage measured 2026-10-23T19:05:58.725Z from commit 2ce8b9544e108aa1b57b52d1b402a76ece65e114 plus working changes, using npm run test:coverage. All core source modules are included; no source module is excluded to inflate coverage.

| Metric     | Coverage |
| ---------- | -------: |
| Lines      |   98.26% |
| Statements |   94.26% |
| Functions  |   97.79% |
| Branches   |   83.33% |

Checks: npm ci; npm run build; npm test; npm run test:coverage; npm run build:frontend; npm run test:frontend; npm run lint; npm run format:check.

Route tests use Supertest, real in-memory core algorithms, and mocked Redis/Mongo methods. The isolated Docker E2E test uses real Redis and MongoDB, a local HTTP fixture, API and crawler processes, concurrent frontier consumers, stale-lease recovery, SimHash filtering, robots exclusion, phrase queries, autocomplete, typo suggestions, caching, and an API snapshot restart. Run npm run test:e2e. It cannot run on this host while Docker's daemon is unavailable; CI runs it separately. No deployment is configured.
