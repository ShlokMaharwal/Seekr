import { spawnSync } from 'node:child_process';
const args = ['compose', '-f', 'tests/e2e/compose.yml'];
let status = 1;
try {
  const result = spawnSync(
    'docker',
    [...args, 'up', '--build', '--abort-on-container-exit', '--exit-code-from', 'tests'],
    { stdio: 'inherit' },
  );
  if (result.error) console.error(result.error.message);
  status = result.status ?? 1;
} finally {
  spawnSync('docker', [...args, 'down', '--remove-orphans'], { stdio: 'inherit' });
}
process.exitCode = status;
