// Boots a complete, isolated stack for Playwright: in-memory MongoDB 8.0, local-disk storage in a
// temp folder, seeded demo data with a real MP3, and the production build (`next start`).
import { spawn } from 'node:child_process';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MongoMemoryReplSet } from 'mongodb-memory-server-core';

const PORT = process.env.E2E_PORT ?? '3100';
const BASE = `http://localhost:${PORT}`;

const mongo = await MongoMemoryReplSet.create({
  binary: { version: '8.0.12' },
  replSet: { count: 1 },
});
const storageDir = await mkdtemp(join(tmpdir(), 'tilawah-e2e-'));
const env: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: 'production',
  NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_APP_URL: BASE,
  API_ALLOWED_ORIGINS: BASE,
  MONGODB_URI: mongo.getUri('tilawah_e2e'),
  BETTER_AUTH_SECRET: 'e2e-better-auth-secret-0123456789abcdef0123',
  BETTER_AUTH_URL: BASE,
  UPLOAD_TICKET_SECRET: 'e2e-upload-ticket-secret-0123456789abcdef',
  IP_HASH_SECRET: 'e2e-ip-hash-secret-0123456789abcdef012345',
  STORAGE_DRIVER: 'local',
  LOCAL_STORAGE_DIR: storageDir,
  EMAIL_TRANSPORT: 'none',
  AUTH_RATE_LIMIT: 'off',
};
Object.assign(process.env, env);

const { seed } = await import('../scripts/seed');
await seed({
  audio: await readFile(new URL('./fixtures/sample-recitation.mp3', import.meta.url)),
  quiet: true,
});
const { getContainer } = await import('../server/container');
await (await getContainer()).database?.close();

const next = spawn('pnpm', ['exec', 'next', 'start', '-p', PORT], { env, stdio: 'inherit' });
const stop = async () => {
  next.kill('SIGTERM');
  await mongo.stop();
  process.exit(0);
};
process.on('SIGTERM', () => void stop());
process.on('SIGINT', () => void stop());
next.on('exit', (code) => {
  void mongo.stop().then(() => process.exit(code ?? 0));
});
