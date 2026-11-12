// CI: if packages/contracts/openapi.json changed compared with the base branch, the contracts
// version must change too (installed mobile apps depend on the API staying stable).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const base = process.argv[2] ?? 'origin/main';
const show = (path) => {
  try {
    return execFileSync('git', ['show', `${base}:${path}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
};

const before = show('packages/contracts/openapi.json');
if (before === null) {
  console.log(`No openapi.json on ${base}; nothing to compare.`);
  process.exit(0);
}
const after = readFileSync('packages/contracts/openapi.json', 'utf8');
if (before === after) {
  console.log('API contract unchanged.');
  process.exit(0);
}
const oldVersion = JSON.parse(before).info.version;
const newVersion = JSON.parse(after).info.version;
if (oldVersion === newVersion) {
  console.error(
    `openapi.json changed but the API version is still ${newVersion}. Bump "version" in packages/contracts/package.json and run pnpm openapi.`,
  );
  process.exit(1);
}
console.log(`API contract changed: ${oldVersion} → ${newVersion}.`);
