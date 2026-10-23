# Verification

Coverage measured 2026-10-23T19:46Z from commit c84d5c1 plus phase 7 working changes, using npm run test:coverage. All core source modules are included; no source module is excluded to inflate coverage.

| Metric     | Coverage |
| ---------- | -------: |
| Lines      |   98.27% |
| Statements |   94.28% |
| Functions  |   97.81% |
| Branches   |   83.50% |

Checks: npm ci; npm run build; npm test; npm run test:coverage; npm run build:frontend; npm run typecheck:frontend; npm run test:frontend; npm run lint; npm run format:check.

Route tests use Supertest, real in-memory core algorithms, and mocked Redis/Mongo methods. The isolated Docker E2E test uses real Redis and MongoDB, a local HTTP fixture, API and crawler processes, concurrent frontier consumers, stale-lease recovery, SimHash filtering, robots exclusion, phrase queries, autocomplete, typo suggestions, caching, and an API snapshot restart. Run npm run test:e2e. It cannot run on this host while Docker's daemon is unavailable; CI runs it separately. No deployment is configured.

The [Linux CI run for c0ffe53](https://github.com/ShlokMaharwal/Seekr/actions/runs/40010931478)
passed the quality check, Docker E2E test, and fixture benchmarks. The local
Windows build/test checks also passed; the local Docker daemon limitation does
not invalidate the separately verified Linux stack run.
