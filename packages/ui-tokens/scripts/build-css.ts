import { readFileSync, writeFileSync } from 'node:fs';
import { tokensCss } from '../src/index';

const target = new URL('../tokens.css', import.meta.url);
const css = tokensCss();
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== css) {
    console.error('tokens.css is stale. Run pnpm --filter @tilawah/ui-tokens build:css');
    process.exit(1);
  }
} else {
  writeFileSync(target, css);
}
