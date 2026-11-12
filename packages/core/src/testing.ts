// Test helpers shared by core and web tests. In-memory MongoDB, in-memory storage, fixed clock.
import type { Role } from '@tilawah/contracts';
import type { RecitationDoc, UserDoc } from '@tilawah/db';
import { startTestDatabase, type TestDatabase } from '@tilawah/db/testing';
import type { Actor } from './actor';
import type { Clock } from './clock';
import { createCore, type Core } from './core';
import { newId } from './repositories/keyset';
import { MemoryStorage } from './storage/memory';

export class TestClock implements Clock {
  constructor(public current = new Date('2026-11-12T08:00:00.000Z')) {}
  now(): Date {
    return new Date(this.current);
  }
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export const TEST_CONFIG = { uploadTicketSecret: 'test-upload-secret', publicAudioBaseUrl: null };

export interface TestCore {
  core: Core;
  db: TestDatabase;
  storage: MemoryStorage;
  clock: TestClock;
  reset(): Promise<void>;
  stop(): Promise<void>;
}

export async function startTestCore(): Promise<TestCore> {
  const db = await startTestDatabase();
  const storage = new MemoryStorage();
  const clock = new TestClock();
  const core = createCore({ database: db.database, storage, clock, config: TEST_CONFIG });
  return {
    core,
    db,
    storage,
    clock,
    async reset() {
      await db.reset();
      storage.objects.clear();
      storage.failDeletes = false;
      clock.current = new Date('2026-11-12T08:00:00.000Z');
    },
    stop: () => db.stop(),
  };
}

let counter = 0;

export interface UserOptions {
  role?: Role;
  verifiedReciter?: boolean;
  reciter?: boolean;
  name?: string;
}

/** Inserts a user (as Better Auth would) and returns it with a matching Actor. */
export async function createUser(t: TestCore, options: UserOptions = {}) {
  counter += 1;
  const reciterSince = options.reciter || options.verifiedReciter ? t.clock.now() : null;
  const created = await t.db.database.models.User.create({
    name: options.name ?? `User ${counter}`,
    email: `user${counter}@example.com`,
    emailVerified: true,
    role: options.role ?? 'user',
    mode: reciterSince ? 'reciter' : 'listener',
    reciterSince,
    verifiedReciter: options.verifiedReciter ?? false,
  });
  const user = created.toObject<UserDoc>();
  return { user, actor: actorOf(user, t.clock.now()) };
}

export function actorOf(user: UserDoc, sessionCreatedAt: Date): Actor {
  return {
    userId: user._id.toHexString(),
    role: user.role,
    mode: user.mode,
    reciterSince: user.reciterSince,
    verifiedReciter: user.verifiedReciter,
    sessionCreatedAt,
  };
}

/** Inserts a recitation directly, bypassing the upload flow. */
export async function insertRecitation(
  t: TestCore,
  uploader: UserDoc,
  overrides: Partial<RecitationDoc> = {},
): Promise<RecitationDoc> {
  const _id = overrides._id ?? newId();
  const audioKey = overrides.audioKey ?? `audio/${_id.toHexString()}.mp3`;
  t.storage.put(audioKey, overrides.sizeBytes ?? 1_000_000, 'audio/mpeg');
  const created = await t.db.database.models.Recitation.create({
    _id,
    uploaderId: uploader._id,
    surah: 112,
    ayahFrom: 1,
    ayahTo: 4,
    title: 'Al-Ikhlas',
    riwayah: 'hafs',
    style: 'murattal',
    audioKey,
    audioContentType: 'audio/mpeg',
    durationSec: 30,
    sizeBytes: 1_000_000,
    status: 'approved',
    rightsConfirmedAt: t.clock.now(),
    createdAt: t.clock.now(),
    ...overrides,
  });
  return created.toObject<RecitationDoc>();
}
