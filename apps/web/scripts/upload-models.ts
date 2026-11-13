// Uploads the speech models (apps/web/public/models) to a public R2 bucket for production.
//
//   MODELS_BUCKET=tilawah-models pnpm --filter @tilawah/web models:upload
//
// Uses the R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY from .env.local (the token
// needs write access to MODELS_BUCKET). Checksums are verified against each MANIFEST.json first,
// and files already uploaded with the same size are skipped. Then set
// NEXT_PUBLIC_SPEECH_MODEL_BASE_URL to the bucket's public URL (docs/DEPLOYMENT.md).
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = new URL('../public/models/', import.meta.url).pathname;
const bucket = process.env.MODELS_BUCKET;
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
if (!bucket || !R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('Set MODELS_BUCKET and the R2_* credentials (see the header of this file).');
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

const TYPES: Record<string, string> = {
  '.json': 'application/json',
  '.onnx': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
};

async function files(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await files(path)));
    else out.push(path);
  }
  return out;
}

let uploaded = 0;
let skipped = 0;
for (const model of await readdir(root)) {
  const dir = join(root, model);
  if (!(await stat(dir)).isDirectory()) continue;
  const manifest = JSON.parse(await readFile(join(dir, 'MANIFEST.json'), 'utf8')) as {
    files: Record<string, { bytes: number; sha256: string }>;
  };
  for (const path of await files(dir)) {
    const name = relative(dir, path);
    const key = `${model}/${name}`;
    const body = await readFile(path);
    const expected = manifest.files[name];
    if (name !== 'MANIFEST.json') {
      const sha = createHash('sha256').update(body).digest('hex');
      if (expected?.sha256 !== sha)
        throw new Error(`${key}: checksum does not match MANIFEST.json`);
    }
    const existing = await s3
      .send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
      .catch(() => null);
    if (existing?.ContentLength === body.length && name !== 'MANIFEST.json') {
      skipped += 1;
      continue;
    }
    const ext = name.slice(name.lastIndexOf('.'));
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: TYPES[ext] ?? 'application/octet-stream',
        // Files never change for a model revision; a new conversion gets a new folder name.
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    uploaded += 1;
    console.warn(`uploaded ${key} (${(body.length / 1e6).toFixed(1)} MB)`);
  }
}
console.warn(`Done: ${String(uploaded)} uploaded, ${String(skipped)} already there.`);
