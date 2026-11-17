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
