#!/usr/bin/env node
// Runs the native TypeScript 7 compiler (installed as @typescript/native) for type-checking.
// TypeScript 6 stays installed as `typescript` because typescript-eslint and Next.js need its
// JavaScript API, which TypeScript 7 does not provide yet. See docs/ARCHITECTURE.md §3.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
// bin/tsc is not in the package's exports map, so locate it from package.json.
const tsc = join(dirname(require.resolve('@typescript/native/package.json')), 'bin', 'tsc');
const result = spawnSync(process.execPath, [tsc, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(result.status ?? 1);
