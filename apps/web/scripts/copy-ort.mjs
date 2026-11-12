// Copies the ONNX Runtime Web binaries next to the site (public/ort) so the speech model never
// loads code from a third-party CDN. Runs before dev and build.
import { copyFileSync, existsSync, mkdirSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

const here = dirname(new URL(import.meta.url).pathname);
// transformers.js depends on its own onnxruntime-web build; find the copy next to it.
const transformers = realpathSync(join(here, '../node_modules/@huggingface/transformers'));
const candidates = [
  join(transformers, '../../onnxruntime-web'),
  join(transformers, 'node_modules/onnxruntime-web'),
];
const ort = candidates.find((dir) => existsSync(join(dir, 'dist')));
if (!ort) throw new Error('onnxruntime-web (dependency of @huggingface/transformers) not found');

const out = join(here, '../public/ort');
mkdirSync(out, { recursive: true });
// The default build runs WebGPU and WebAssembly ("asyncify"); the plain one is for Safari < 26
// without WebGPU. Old builds (jsep) are removed so they are not deployed.
const builds = ['ort-wasm-simd-threaded.asyncify', 'ort-wasm-simd-threaded'];
for (const file of readdirSync(out)) {
  if (!builds.some((b) => file === `${b}.mjs` || file === `${b}.wasm`)) rmSync(join(out, file));
}
for (const build of builds) {
  for (const ext of ['mjs', 'wasm'])
    copyFileSync(join(ort, 'dist', `${build}.${ext}`), join(out, `${build}.${ext}`));
}
console.warn(
  `ONNX Runtime Web copied to public/ort (${realpathSync(ort).split('/node_modules/').pop() ?? ort})`,
);
