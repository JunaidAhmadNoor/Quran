import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DAY_MS, HOUR_MS } from '../src/clock';
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

const list = (actor: Parameters<TestCore['core']['recitations']['list']>[0], extra = {}) =>
  t.core.recitations.list(actor, { sort: 'newest', limit: 20, ...extra });

describe('visibility of pending uploads', () => {
  it('hides pending uploads from public lists but shows them to the uploader and moderators', async () => {
    const { user: owner, actor: ownerActor } = await createUser(t, { reciter: true });
    const { actor: stranger } = await createUser(t);
    const { actor: moderator } = await createUser(t, { role: 'moderator' });
    const pending = await insertRecitation(t, owner, { status: 'pending' });
    const id = pending._id.toHexString();

    expect((await list(null)).items).toHaveLength(0);
    expect((await list(ownerActor)).items).toHaveLength(0); // public list stays approved-only
    expect(await errorCode(t.core.recitations.get(null, id))).toBe('NOT_FOUND');
    expect(await errorCode(t.core.recitations.get(stranger, id))).toBe('NOT_FOUND');
    expect((await t.core.recitations.get(ownerActor, id)).status).toBe('pending');
    expect((await t.core.recitations.get(moderator, id)).status).toBe('pending');
    const mine = await t.core.recitations.listMine(ownerActor, { limit: 20 });
    expect(mine.items.map((r) => r.id)).toEqual([id]);
  });

  it('shows the moderation note and size only to the owner and moderators', async () => {
    const { user: owner, actor: ownerActor } = await createUser(t, { reciter: true });
    const { actor: stranger } = await createUser(t);
    const doc = await insertRecitation(t, owner, { moderationNote: 'note' });
    const id = doc._id.toHexString();
    expect((await t.core.recitations.get(ownerActor, id)).moderationNote).toBe('note');
    const forStranger = await t.core.recitations.get(stranger, id);
    expect(forStranger.moderationNote).toBeNull();
    expect(forStranger.sizeBytes).toBeNull();
    expect(forStranger.viewer).toEqual({ liked: false, isOwner: false });
    expect((await t.core.recitations.get(null, id)).viewer).toBeNull();
  });

  it('signs short stream URLs: 6 hours for approved, 15 minutes for pending', async () => {
    const { user, actor } = await createUser(t, { reciter: true });
    const approved = await t.core.recitations.get(
      null,
      (await insertRecitation(t, user))._id.toHexString(),
    );
    const pending = await t.core.recitations.get(
      actor,
      (await insertRecitation(t, user, { status: 'pending' }))._id.toHexString(),
    );
    const ttl = (iso: string | null) => (Date.parse(iso ?? '') - t.clock.now().getTime()) / 60_000;
    expect(ttl(approved.stream.expiresAt)).toBe(360);
    expect(ttl(pending.stream.expiresAt)).toBe(15);
  });
});

describe('editing', () => {
  it('stops a user from editing another user’s recitation', async () => {
    const { user: owner } = await createUser(t, { reciter: true });
    const { actor: other } = await createUser(t);
    const doc = await insertRecitation(t, owner);
    expect(
      await errorCode(
        t.core.recitations.update(other, doc._id.toHexString(), { title: 'Mine now' }),
      ),
    ).toBe('FORBIDDEN');
  });

  it('lets a moderator edit anyone’s recitation', async () => {
    const { user: owner } = await createUser(t, { reciter: true });
    const { actor: moderator } = await createUser(t, { role: 'moderator' });
    const doc = await insertRecitation(t, owner);
    const updated = await t.core.recitations.update(moderator, doc._id.toHexString(), {
      ayahTo: 2,
    });
    expect(updated).toMatchObject({ ayahTo: 2, status: 'approved' });
  });

  it('sends an approved recitation back to review when a non-verified owner changes its range', async () => {
    const { user, actor } = await createUser(t, { reciter: true });
    const doc = await insertRecitation(t, user);
    const id = doc._id.toHexString();
    expect((await t.core.recitations.update(actor, id, { title: 'New title' })).status).toBe(
      'approved',
    );
    expect((await t.core.recitations.update(actor, id, { ayahTo: 3 })).status).toBe('pending');
  });

  it('keeps a verified reciter’s edit approved', async () => {
    const { user, actor } = await createUser(t, { verifiedReciter: true });
    const doc = await insertRecitation(t, user);
    expect(
      (await t.core.recitations.update(actor, doc._id.toHexString(), { surah: 1, ayahTo: 7 }))
        .status,
    ).toBe('approved');
  });

  it('rejects an ayah range that does not exist', async () => {
    const { user, actor } = await createUser(t, { reciter: true });
    const doc = await insertRecitation(t, user);
    expect(
      await errorCode(t.core.recitations.update(actor, doc._id.toHexString(), { ayahTo: 9 })),
    ).toBe('INVALID_AYAH_RANGE');
  });

  it('removes a recitation, deletes its audio, and refuses later edits', async () => {
    const { user, actor } = await createUser(t, { reciter: true });
    const doc = await insertRecitation(t, user);
    const id = doc._id.toHexString();
    await t.core.recitations.remove(actor, id);
    expect(t.storage.objects.has(doc.audioKey)).toBe(false);
    expect((await t.core.recitations.get(actor, id)).status).toBe('removed');
    expect(await errorCode(t.core.recitations.update(actor, id, { title: 'x' }))).toBe('CONFLICT');
    await t.core.recitations.remove(actor, id); // idempotent
  });

  it('keeps the recitation removed when audio deletion fails, for the maintenance job to retry', async () => {
    const { user, actor } = await createUser(t, { reciter: true });
    const doc = await insertRecitation(t, user);
    t.storage.failDeletes = true;
    await t.core.recitations.remove(actor, doc._id.toHexString());
    t.storage.failDeletes = false;
    expect(await t.core.maintenance.purgeAudio()).toEqual({ purged: 1 });
    expect(t.storage.objects.has(doc.audioKey)).toBe(false);
  });
});

describe('likes', () => {
  it('does not double-count a second like, and unlike decrements', async () => {
    const { user: owner } = await createUser(t, { reciter: true });
    const { actor } = await createUser(t);
    const id = (await insertRecitation(t, owner))._id.toHexString();
    expect(await t.core.recitations.like(actor, id)).toEqual({ liked: true, likeCount: 1 });
    expect(await t.core.recitations.like(actor, id)).toEqual({ liked: true, likeCount: 1 });
    expect((await t.core.recitations.get(actor, id)).viewer?.liked).toBe(true);
    expect(await t.core.recitations.unlike(actor, id)).toEqual({ liked: false, likeCount: 0 });
    expect(await t.core.recitations.unlike(actor, id)).toEqual({ liked: false, likeCount: 0 });
  });

  it('cannot like a pending recitation', async () => {
    const { user: owner } = await createUser(t, { reciter: true });
    const { actor } = await createUser(t);
    const id = (await insertRecitation(t, owner, { status: 'pending' }))._id.toHexString();
    expect(await errorCode(t.core.recitations.like(actor, id))).toBe('NOT_FOUND');
  });
});

describe('plays', () => {
  it('counts a listener once per 6 hours', async () => {
    const { user } = await createUser(t, { reciter: true });
    const id = (await insertRecitation(t, user))._id.toHexString();
    expect(await t.core.recitations.recordPlay('ip:a', id)).toEqual({
      counted: true,
      playCount: 1,
    });
    expect(await t.core.recitations.recordPlay('ip:a', id)).toEqual({
      counted: false,
      playCount: 1,
    });
    expect(await t.core.recitations.recordPlay('ip:b', id)).toEqual({
      counted: true,
      playCount: 2,
    });
    t.clock.advance(6 * HOUR_MS);
    expect(await t.core.recitations.recordPlay('ip:a', id)).toEqual({
      counted: true,
      playCount: 3,
    });
  });

  it('ranks trending by plays in the last 7 days', async () => {
    const { user } = await createUser(t, { reciter: true });
    const old = (
      await insertRecitation(t, user, { title: 'old favourite', playCount: 1000 })
    )._id.toHexString();
    const fresh = (await insertRecitation(t, user, { title: 'this week' }))._id.toHexString();
    await t.core.recitations.recordPlay('ip:a', old);
    t.clock.advance(8 * DAY_MS);
    for (const listener of ['ip:a', 'ip:b']) await t.core.recitations.recordPlay(listener, fresh);
    const trending = await list(null, { sort: 'trending' });
    expect(trending.items.map((r) => r.title)).toEqual(['this week']);
    const popular = await list(null, { sort: 'popular' });
    expect(popular.items.map((r) => r.title)).toEqual(['old favourite', 'this week']);
  });
});

describe('reports', () => {
  it('accepts one open report per user per recitation', async () => {
    const { user: owner } = await createUser(t, { reciter: true });
    const { actor } = await createUser(t);
    const id = (await insertRecitation(t, owner))._id.toHexString();
    const receipt = await t.core.recitations.report(actor, id, { reason: 'wrong_surah' });
    expect(receipt.status).toBe('open');
    expect(
      await errorCode(t.core.recitations.report(actor, id, { reason: 'other', note: 'again' })),
    ).toBe('ALREADY_REPORTED');
  });
});

describe('pagination', () => {
  it('keeps cursors stable when new items arrive', async () => {
    const { user } = await createUser(t, { reciter: true });
    for (let i = 0; i < 5; i++) {
      await insertRecitation(t, user, { title: `r${i}` });
      t.clock.advance(1000);
    }
    const first = await list(null, { limit: 2 });
    expect(first.items.map((r) => r.title)).toEqual(['r4', 'r3']);
    await insertRecitation(t, user, { title: 'new arrival' });
    const second = await list(null, { limit: 2, cursor: first.nextCursor ?? undefined });
    expect(second.items.map((r) => r.title)).toEqual(['r2', 'r1']);
    const third = await list(null, { limit: 2, cursor: second.nextCursor ?? undefined });
    expect(third.items.map((r) => r.title)).toEqual(['r0']);
    expect(third.nextCursor).toBeNull();
  });

  it('breaks ties on equal timestamps by id without skipping or repeating', async () => {
    const { user } = await createUser(t, { reciter: true });
    for (let i = 0; i < 5; i++) await insertRecitation(t, user, { title: `same${i}` });
    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const pageResult = await list(null, { limit: 2, cursor });
      seen.push(...pageResult.items.map((r) => r.title));
      cursor = pageResult.nextCursor ?? undefined;
    } while (cursor);
    expect(new Set(seen).size).toBe(5);
  });

  it('rejects a cursor used with different filters', async () => {
    const { user } = await createUser(t, { reciter: true });
    for (let i = 0; i < 3; i++) await insertRecitation(t, user);
    const first = await list(null, { limit: 1 });
    expect(
      await errorCode(list(null, { limit: 1, cursor: first.nextCursor ?? undefined, surah: 1 })),
    ).toBe('VALIDATION_ERROR');
  });

  it('filters by surah, reciter and style', async () => {
    const { user: a } = await createUser(t, { reciter: true });
    const { user: b } = await createUser(t, { reciter: true });
    await insertRecitation(t, a, { surah: 1, ayahTo: 7, style: 'mujawwad' });
    await insertRecitation(t, b);
    expect((await list(null, { surah: 1 })).items).toHaveLength(1);
    expect((await list(null, { reciterId: b._id.toHexString() })).items).toHaveLength(1);
    expect((await list(null, { style: 'mujawwad' })).items[0]?.surah).toBe(1);
  });
});
