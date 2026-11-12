// Writes openapi.json from the Zod contracts. With --check, fails instead of writing when the
// committed file is out of date (used in CI).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildOpenApiDocument } from '../src/openapi';

const root = new URL('..', import.meta.url);
const outFile = fileURLToPath(new URL('openapi.json', root));
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8')) as { version: string };

const generated = `${JSON.stringify(buildOpenApiDocument({ version: pkg.version }), null, 2)}\n`;

if (process.argv.includes('--check')) {
  let committed = '';
  try {
    committed = readFileSync(outFile, 'utf8');
  } catch {
    // Missing file is reported below as out of date.
  }
  if (committed !== generated) {
    console.error(
      'openapi.json is out of date. Run `pnpm openapi`, bump the version in packages/contracts/package.json, and commit both.',
    );
    process.exit(1);
  }
  process.stdout.write('openapi.json is up to date.\n');
} else {
  writeFileSync(outFile, generated);
  process.stdout.write(`Wrote ${outFile}\n`);
}
