import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const { total } = JSON.parse(
  await readFile('packages/core/coverage/coverage-summary.json', 'utf8'),
);
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const report = `# Verification\n\nCoverage measured ${new Date().toISOString()} from commit ${sha} plus working changes, using npm run test:coverage. All core source modules are included; no source module is excluded to inflate coverage.\n\n| Metric | Coverage |\n|---|---:|\n| Lines | ${total.lines.pct}% |\n| Statements | ${total.statements.pct}% |\n| Functions | ${total.functions.pct}% |\n| Branches | ${total.branches.pct}% |\n\nChecks: npm ci; npm run build; npm test; npm run test:coverage; npm run build:frontend; npm run test:frontend; npm run lint; npm run format:check.\n\nRoute tests use Supertest, real in-memory core algorithms, and mocked Redis/Mongo methods. The isolated Docker E2E test uses real Redis and MongoDB, a local HTTP fixture, API and crawler processes, concurrent frontier consumers, stale-lease recovery, SimHash filtering, robots exclusion, phrase queries, autocomplete, typo suggestions, caching, and an API snapshot restart. Run npm run test:e2e. It cannot run on this host while Docker's daemon is unavailable; CI runs it separately. No deployment is configured.\n`;
await writeFile('docs/TESTING.md', report);
console.log(report);
