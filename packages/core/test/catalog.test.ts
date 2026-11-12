import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DAY_MS } from '../src/clock';
import type { DomainError } from '../src/errors';
import { createUser, insertRecitation, startTestCore, type TestCore } from '../src/testing';

let t: TestCore;
beforeAll(async () => {
  t = await startTestCore();
});
afterAll(() => t.stop());
beforeEach(() => t.reset());

const errorCode = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return (e as DomainError).code;
  }
  return 'NO_ERROR';
};

const session = (overrides = {}) => ({
  surah: 112,
  ayahFrom: 1,
  ayahTo: 4,
  mode: 'reveal' as const,
  wordsTotal: 15,
  wordsCorrect: 12,
  mistakes: [{ ayah: 3, word: 2, type: 'missed' as const }],
  startedAt: '2026-11-12T08:00:00.000Z',
  endedAt: '2026-11-12T08:02:00.000Z',
  ...overrides,
});

describe('surahs', () => {
  it('lists 114 surahs and serves one with its approved recitations', async () => {
    expect(t.core.surahs.list().items).toHaveLength(114);
    const { user } = await createUser(t, { reciter: true });
    await insertRecitation(t, user);
    await insertRecitation(t, user, { status: 'pending' });
    const ikhlas = await t.core.surahs.get(null, 112, { sort: 'popular', limit: 20 });
    expect(ikhlas.surah.nameEnglish).toBeTruthy();
    expect(ikhlas.recitations.items).toHaveLength(1);
  });

  it('serves the verified text with attribution', async () => {
    const text = await t.core.surahs.text(1);
    expect(text.ayahs).toHaveLength(7);
    expect(text.source.name).toBe('Tanzil Quran Text');
    expect(await errorCode(t.core.surahs.text(115))).toBe('NOT_FOUND');
    expect(await errorCode(t.core.surahs.get(null, 0, { sort: 'popular', limit: 20 }))).toBe(
      'NOT_FOUND',
    );
  });
});

describe('reciters', () => {
  it('lists verified reciters only', async () => {
    await createUser(t, { reciter: true });
    const { user } = await createUser(t, { verifiedReciter: true, name: 'Verified' });
    await insertRecitation(t, user, { playCount: 7 });
    const page = await t.core.reciters.listVerified({ limit: 20 });
    expect(page.items.map((r) => r.name)).toEqual(['Verified']);
    const profile = await t.core.reciters.get(null, user._id.toHexString(), {
      sort: 'newest',
      limit: 20,
    });
    expect(profile.reciter.stats).toEqual({ approvedRecitations: 1, totalPlays: 7 });
  });
});

describe('memorization', () => {
  it('saves a session and keeps the best progress', async () => {
    const { actor } = await createUser(t);
    const first = await t.core.memorization.saveSession(actor, session());
    expect(first.accuracy).toBeCloseTo(0.8);
    expect(first.progress).toMatchObject({ surah: 112, lastAyah: 4, bestAccuracy: 0.8 });
    await t.core.memorization.saveSession(
      actor,
      session({ ayahTo: 2, wordsTotal: 6, wordsCorrect: 3, mistakes: [] }),
    );
    const progress = await t.core.memorization.progress(actor);
    expect(progress.items).toEqual([
      { surah: 112, lastAyah: 4, bestAccuracy: 0.8, lastPracticedAt: '2026-11-12T08:02:00.000Z' },
    ]);
  });

  it('checks the word count and mistake positions against the real text', async () => {
    const { actor } = await createUser(t);
    expect(
      await errorCode(t.core.memorization.saveSession(actor, session({ wordsTotal: 16 }))),
    ).toBe('VALIDATION_ERROR');
    expect(
      await errorCode(
        t.core.memorization.saveSession(
          actor,
          session({ mistakes: [{ ayah: 1, word: 9, type: 'missed' }] }),
        ),
      ),
    ).toBe('VALIDATION_ERROR');
    expect(await errorCode(t.core.memorization.saveSession(actor, session({ ayahTo: 5 })))).toBe(
      'INVALID_AYAH_RANGE',
    );
  });
});

describe('rate limiting', () => {
  it('allows the limit, then returns RATE_LIMITED with retryAfterSec, then resets', async () => {
    for (let i = 0; i < 20; i++) await t.core.rateLimiter.consume('report', 'user:1');
    let error: DomainError | undefined;
    try {
      await t.core.rateLimiter.consume('report', 'user:1');
    } catch (e) {
      error = e as DomainError;
    }
    expect(error?.code).toBe('RATE_LIMITED');
    expect(error?.details.retryAfterSec).toBeGreaterThan(0);
    await t.core.rateLimiter.consume('report', 'user:2');
    t.clock.advance(DAY_MS);
    await t.core.rateLimiter.consume('report', 'user:1');
  });
});

describe('maintenance and health', () => {
  it('deletes audio of rejected recitations after 7 days', async () => {
    const { user } = await createUser(t, { reciter: true });
    const rejected = await insertRecitation(t, user, {
      status: 'rejected',
      moderatedAt: t.clock.now(),
    });
    expect(await t.core.maintenance.purgeAudio()).toEqual({ purged: 0 });
    t.clock.advance(8 * DAY_MS);
    expect(await t.core.maintenance.purgeAudio()).toEqual({ purged: 1 });
    expect(t.storage.objects.has(rejected.audioKey)).toBe(false);
  });

  it('reports a healthy database', async () => {
    expect(await t.core.health.check('1.0.0', t.clock.now())).toMatchObject({
      status: 'ok',
      checks: { database: 'ok' },
    });
  });
});
