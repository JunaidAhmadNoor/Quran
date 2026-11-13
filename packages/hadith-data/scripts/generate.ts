// Downloads the pinned upstream editions (verifying their SHA-256 against source/MANIFEST.json),
// then writes generated/. The 41 MB of source JSON is cached in .cache/ (gitignored), not committed.
//   pnpm --filter @tilawah/hadith-data generate            write generated/
//   pnpm --filter @tilawah/hadith-data generate --check    fail if generated/ is stale
//   pnpm --filter @tilawah/hadith-data generate --record   record the hashes of a new upstream commit
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildBook, buildLoaders, sha256, type Edition, type Language } from '../src/build';
import type { BookId } from '../src/types';

const root = new URL('..', import.meta.url);
const path = (p: string) => fileURLToPath(new URL(p, root));
const manifestPath = path('source/MANIFEST.json');

interface Manifest {
  upstream: { repository: string; commit: string; cdn: string };
  editions: Record<
    string,
    { book: BookId; language: Language; translator: string; sha256: string }
  >;
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
const check = process.argv.includes('--check');
const record = process.argv.includes('--record');

async function edition(name: string): Promise<{ data: Edition; raw: Buffer }> {
  mkdirSync(path('.cache'), { recursive: true });
  const cached = path(`.cache/${manifest.upstream.commit}-${name}.min.json`);
  if (!existsSync(cached)) {
    const url = `${manifest.upstream.cdn}@${manifest.upstream.commit}/editions/${name}.min.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${String(res.status)}`);
    writeFileSync(cached, Buffer.from(await res.arrayBuffer()));
  }
  const raw = readFileSync(cached);
  return { data: JSON.parse(raw.toString('utf8')) as Edition, raw };
}

const files = new Map<string, string>();
for (const book of ['bukhari', 'muslim'] as const) {
  const editions = {} as Record<Language, Edition>;
  for (const [name, info] of Object.entries(manifest.editions)) {
    if (info.book !== book) continue;
    const { data, raw } = await edition(name);
    const hash = sha256(raw);
    if (record) info.sha256 = hash;
    else if (hash !== info.sha256)
      throw new Error(`${name}: SHA-256 ${hash} does not match MANIFEST.json (${info.sha256})`);
    editions[info.language] = data;
  }
  for (const [p, content] of buildBook(book, editions)) files.set(p, content);
}
files.set('loaders.ts', buildLoaders([...files.keys()]));
// Hashes of every generated file: the tests detect any hand edit of the texts.
const hashes: Record<string, string> = Object.fromEntries(
  [...files]
    .map(([p, c]): [string, string] => [p, sha256(c)])
    .sort(([a], [b]) => a.localeCompare(b)),
);
files.set('HASHES.json', `${JSON.stringify(hashes, null, 2)}\n`);

if (record) writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const stale: string[] = [];
for (const [p, content] of files) {
  const target = path(`generated/${p}`);
  if (check) {
    const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
    if (current !== content) stale.push(p);
  } else {
    mkdirSync(path(`generated/${p.split('/').slice(0, -1).join('/')}`), { recursive: true });
    writeFileSync(target, content);
  }
}
if (check && stale.length > 0) {
  console.error(`Stale generated files (run generate):\n${stale.slice(0, 20).join('\n')}`);
  process.exit(1);
}
process.stdout.write(
  check ? 'generated/ is up to date.\n' : `Wrote ${String(files.size)} files.\n`,
);
