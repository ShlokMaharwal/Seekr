import { spawnSync, execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
await mkdir('data/bench', { recursive: true });
const args = ['compose', '-f', 'tests/e2e/compose.yml', '-f', 'tests/e2e/bench-compose.yml'];
const env = {
  ...process.env,
  BENCH_COMMIT: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
};
let status = 1;
try {
  const result = spawnSync(
    'docker',
    [...args, 'up', '--build', '--abort-on-container-exit', '--exit-code-from', 'tests'],
    { stdio: 'inherit', env },
  );
  if (result.error) console.error(result.error.message);
  status = result.status ?? 1;
} finally {
  spawnSync('docker', [...args, 'down', '--remove-orphans'], { stdio: 'inherit' });
}
process.exitCode = status;
