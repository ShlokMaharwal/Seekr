import { lstat, realpath, rm } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const outputs = [
  'packages/core/dist',
  'apps/api/dist',
  'apps/crawler/dist',
  'frontend/.output',
  'packages/core/coverage',
  'apps/api/coverage',
  'apps/crawler/coverage',
  'frontend/coverage',
  'packages/core/tsconfig.tsbuildinfo',
  'apps/api/tsconfig.tsbuildinfo',
  'apps/crawler/tsconfig.tsbuildinfo',
];
function inside(target) {
  const path = relative(root, target);
  if (!path || path.startsWith('..') || isAbsolute(path))
    throw new Error(`Refusing cleanup outside workspace: ${target}`);
}
for (const output of outputs) {
  const target = resolve(root, output);
  inside(target);
  const info = await lstat(target).catch((error) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (!info) continue;
  if (info.isSymbolicLink()) throw new Error(`Refusing cleanup through a link: ${target}`);
  inside(await realpath(target));
  console.log(
    `${process.argv.includes('--dry-run') ? 'Would remove' : 'Removing'} verified build output: ${target}`,
  );
  if (!process.argv.includes('--dry-run')) await rm(target, { recursive: true, force: true });
}
