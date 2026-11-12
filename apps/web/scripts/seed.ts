// Local development seed: one demo account per role and sample recitations.
// Run: pnpm --filter @tilawah/web seed   (reads apps/web/.env.local). Refuses to run in production.
// Optional: SEED_AUDIO_FILE=/path/to/file.mp3 uploads that file to R2 for every sample recitation.
import { readFile } from 'node:fs/promises';
import type { RecitationStatus } from '@tilawah/contracts';
import { Types } from '@tilawah/db';
import { getContainer } from '../server/container';
import type { LocalDiskStorage } from '../server/local-storage';

const PASSWORD = process.env.SEED_PASSWORD ?? 'tilawah-demo-123';
const reciterOn = { mode: 'reciter' as const, reciterSince: new Date() };

const ACCOUNTS = [
  { key: 'listener', name: 'Layla (listener)', set: {} },
  { key: 'reciter', name: 'Rami (reciter)', set: reciterOn },
  {
    key: 'verified',
    name: 'Yusuf (verified reciter)',
    set: { ...reciterOn, verifiedReciter: true, country: 'EG' },
  },
  { key: 'moderator', name: 'Maryam (moderator)', set: { role: 'moderator' as const } },
  { key: 'admin', name: 'Adam (admin)', set: { role: 'admin' as const } },
];

const RECITATIONS: {
  by: string;
  surah: number;
  ayahFrom: number;
  ayahTo: number;
  title: string;
  status: RecitationStatus;
  playCount: number;
}[] = [
  {
    by: 'verified',
    surah: 1,
    ayahFrom: 1,
    ayahTo: 7,
    title: 'Al-Fatihah',
    status: 'approved',
    playCount: 42,
  },
  {
    by: 'verified',
    surah: 112,
    ayahFrom: 1,
    ayahTo: 4,
    title: 'Al-Ikhlas',
    status: 'approved',
    playCount: 30,
  },
  {
    by: 'verified',
    surah: 113,
    ayahFrom: 1,
    ayahTo: 5,
    title: 'Al-Falaq',
    status: 'approved',
    playCount: 12,
  },
  {
    by: 'verified',
    surah: 114,
    ayahFrom: 1,
    ayahTo: 6,
    title: 'An-Nas',
    status: 'approved',
    playCount: 9,
  },
  {
    by: 'reciter',
    surah: 2,
    ayahFrom: 255,
    ayahTo: 255,
    title: 'Ayat al-Kursi',
    status: 'approved',
    playCount: 5,
  },
  {
    by: 'reciter',
    surah: 36,
    ayahFrom: 1,
    ayahTo: 12,
    title: 'Ya-Sin, opening',
    status: 'pending',
    playCount: 0,
  },
  {
    by: 'reciter',
    surah: 67,
    ayahFrom: 1,
    ayahTo: 5,
    title: 'Al-Mulk, opening',
    status: 'rejected',
    playCount: 0,
  },
];

export interface SeedOptions {
  password?: string;
  audio?: Uint8Array | null;
  quiet?: boolean;
}

/** Idempotent: existing accounts and recitations are kept. Used by `pnpm seed` and the E2E server. */
export async function seed({ password = PASSWORD, audio = null, quiet = false }: SeedOptions = {}) {
  const { core, auth, database, storage } = await getContainer();
  if (!auth || !database || !storage)
    throw new Error('Container is missing auth, database or storage');

  const ids = new Map<string, Types.ObjectId>();
  for (const account of ACCOUNTS) {
    const email = `${account.key}@tilawah.dev`;
    if (!(await core.users.findByEmail(email))) {
      await auth.api.signUpEmail({ body: { name: account.name, email, password } });
    }
    const user = await core.users.findByEmail(email);
    if (!user) throw new Error(`Could not create ${email}`);
    await core.users.update(user._id.toHexString(), { emailVerified: true, ...account.set });
    ids.set(account.key, user._id);
  }

  const { Recitation } = database.models;
  let created = 0;
  for (const r of RECITATIONS) {
    const uploaderId = ids.get(r.by);
    if (!uploaderId || (await Recitation.exists({ uploaderId, title: r.title }))) continue;
    const _id = new Types.ObjectId();
    const audioKey = `audio/${_id.toHexString()}.mp3`;
    if (audio && 'writeObject' in storage) {
      // Local disk (development / E2E): the app server may not be running yet, so write directly.
      await (storage as LocalDiskStorage).writeObject(audioKey, audio, 'audio/mpeg');
    } else if (audio) {
      const put = await storage.presignPut({
        key: audioKey,
        contentType: 'audio/mpeg',
        sizeBytes: audio.length,
        expiresInSec: 600,
      });
      const response = await fetch(put.url, {
        method: 'PUT',
        headers: put.headers,
        body: new Uint8Array(audio),
      });
      if (!response.ok) throw new Error(`Uploading sample audio failed (HTTP ${response.status})`);
    }
    await Recitation.create({
      _id,
      uploaderId,
      surah: r.surah,
      ayahFrom: r.ayahFrom,
      ayahTo: r.ayahTo,
      title: r.title,
      style: 'murattal',
      audioKey,
      audioContentType: 'audio/mpeg',
      durationSec: audio ? 12 : 60,
      sizeBytes: audio?.length ?? 960_000,
      status: r.status,
      playCount: r.playCount,
      rightsConfirmedAt: new Date(),
      moderationNote: r.status === 'rejected' ? 'Demo: audio quality too low' : null,
    });
    created += 1;
  }

  if (quiet) return;
  console.warn(
    `Seed complete: ${ACCOUNTS.map((a) => `${a.key}@tilawah.dev`).join(', ')}\n` +
      `Password: ${process.env.SEED_PASSWORD ? '(from SEED_PASSWORD)' : PASSWORD}. New recitations: ${created}.` +
      (audio ? '' : '\nNo SEED_AUDIO_FILE given: recitations have no audio in storage.'),
  );
}

// Run directly: pnpm --filter @tilawah/web seed
if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  if (process.env.NODE_ENV === 'production')
    throw new Error('The seed script never runs in production.');
  const audio = process.env.SEED_AUDIO_FILE ? await readFile(process.env.SEED_AUDIO_FILE) : null;
  await seed({ audio });
  const { database } = await getContainer();
  await database?.close();
}
