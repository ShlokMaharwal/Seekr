import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSeedArgs } from './seed.mjs';
test('Docker and local API targets are explicit', () => {
  assert.equal(parseSeedArgs([], {}).apiUrl, 'http://localhost:4001');
  assert.equal(parseSeedArgs(['--local'], {}).apiUrl, 'http://localhost:4000');
  assert.equal(
    parseSeedArgs(['--local', '--url', 'http://localhost:9000'], {}).apiUrl,
    'http://localhost:9000',
  );
});
test('legacy arguments and environment target remain supported', () => {
  assert.equal(parseSeedArgs(['50', 'http://localhost:4444'], {}).maxPages, 50);
  assert.equal(
    parseSeedArgs([], { SEEKR_API_URL: 'http://localhost:5000' }).apiUrl,
    'http://localhost:5000',
  );
});
test('page, delay, worker and protocol limits are checked before a request', () => {
  for (const args of [
    ['--max-pages', '0'],
    ['--workers', '11'],
    ['--delay-ms', '-1'],
    ['--url', 'file:///tmp/a'],
  ])
    assert.throws(() => parseSeedArgs(args, {}));
});
test('flag configuration is passed through without secrets', () => {
  const config = parseSeedArgs(['--max-pages', '20', '--workers', '2', '--watch'], {
    ADMIN_TOKEN: 'not-output',
  });
  assert.equal(config.maxPages, 20);
  assert.equal(config.workers, 2);
  assert.equal(config.watch, true);
  assert.equal(JSON.stringify(config).includes('not-output'), false);
});
