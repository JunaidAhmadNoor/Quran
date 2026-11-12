// Derives generated/ from the verbatim Tanzil files in source/. With --check, fails instead of
// writing when the committed output is stale (used in CI and tests).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildGeneratedFiles } from '../src/generate';

const root = new URL('..', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');

const files = buildGeneratedFiles(read('source/quran-uthmani.txt'), read('source/quran-data.xml'));
const check = process.argv.includes('--check');
const stale: string[] = [];

mkdirSync(new URL('generated/text/', root), { recursive: true });
for (const [path, content] of files) {
  const target = fileURLToPath(new URL(path, root));
  if (check) {
    let current = '';
    try {
      current = readFileSync(target, 'utf8');
    } catch {
      // reported as stale below
    }
    if (current !== content) stale.push(path);
  } else {
    writeFileSync(target, content);
  }
}

if (check && stale.length > 0) {
  console.error(
    `Stale generated files (run pnpm --filter @tilawah/quran-data generate):\n${stale.join('\n')}`,
  );
  process.exit(1);
}
process.stdout.write(check ? 'generated/ is up to date.\n' : `Wrote ${files.size} files.\n`);
