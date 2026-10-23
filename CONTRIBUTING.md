# Contributing

Use Node.js 22.17+, npm, and Docker with Compose v2 for integration work.

```bash
npm ci
npm ci --prefix frontend
npm run build
npm test
npm run test:coverage
npm run build:frontend
npm run test:frontend
npm run typecheck:frontend
npm run lint
npm run format:check
npm run test:e2e
```

Copy `.env.example` and `frontend/.env.example` to local `.env` files, choose an
admin token, and follow the README's Docker/native port instructions. Never commit
real credentials, downloaded data, compiled output, or snapshots.

Keep changes focused and use conventional commits (`fix:`, `feat:`, `test:`,
`docs:`, `chore:`, `ci:`). Run the affected checks before committing. `npm run
format` applies the shared Prettier configuration; ESLint covers TypeScript and
JavaScript with no explicit `any` in source code.

New runtime dependencies should be discussed first. Test/lint tooling belongs in
development dependencies. Keep public routes, parameters, and response shapes
compatible. Explain algorithmic decisions and add regression tests for defects.

For benchmarks, keep source commit, date, machine, corpus fingerprint, and workload
in the report. Use `TBD (run locally)` for unavailable measurements. Generated
fixture measurements and Wikipedia relevance judgments are different workloads.

The MIT license already covers the source. Wikipedia evaluation downloads retain
their source URLs and CC BY-SA attribution separately.
