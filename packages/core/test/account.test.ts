import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DAY_MS } from '../src/clock';
import type { DomainError } from '../src/errors';
import {
  actorOf,
  createUser,
  insertRecitation,
  startTestCore,
  type TestCore,
} from '../src/testing';

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

describe('listener and reciter modes', () => {
  it('switches modes without a new session and turns on the reciter profile once', async () => {
    const { actor } = await createUser(t);
    expect((await t.core.account.me(actor)).mode).toBe('listener');
    const reciter = await t.core.account.switchMode(actor, { mode: 'reciter' });
    expect(reciter.mode).toBe('reciter');
    const since = reciter.reciterSince;
    expect(since).not.toBeNull();

    t.clock.advance(DAY_MS);
    const user = await t.core.users.findById(actor.userId);
    if (!user) throw new Error('missing user');
    const fresh = actorOf(user, actor.sessionCreatedAt); // same session, re-read from the database
    const back = await t.core.account.switchMode(fresh, { mode: 'listener' });
    expect(back.mode).toBe('listener');
    expect(back.reciterSince).toBe(since); // profile stays on
    const again = await t.core.account.switchMode(fresh, { mode: 'reciter' });
    expect(again.reciterSince).toBe(since);
  });

  it('makes the reciter profile public only after the first switch', async () => {
    const { actor } = await createUser(t);
    const query = { sort: 'newest' as const, limit: 20 };
    expect(await errorCode(t.core.reciters.get(null, actor.userId, query))).toBe('NOT_FOUND');
    await t.core.account.switchMode(actor, { mode: 'reciter' });
    expect((await t.core.reciters.get(null, actor.userId, query)).reciter.id).toBe(actor.userId);
  });

  it('reports dashboard numbers for reciter mode', async () => {
    const { user, actor } = await createUser(t, { reciter: true });
    const approved = await insertRecitation(t, user, { likeCount: 2, sizeBytes: 2_000 });
    await insertRecitation(t, user, { status: 'pending', sizeBytes: 3_000 });
    await t.core.recitations.recordPlay('ip:a', approved._id.toHexString());
    const stats = await t.core.account.reciterStats(actor);
    expect(stats).toEqual({
      recitations: { pending: 1, approved: 1, rejected: 0 },
      totalPlays: 1,
      totalLikes: 2,
      playsLast7Days: 1,
      storage: { usedBytes: 5_000, quotaBytes: 300 * 1024 * 1024 },
    });
    const { actor: listener } = await createUser(t);
    expect(await errorCode(t.core.account.reciterStats(listener))).toBe('RECITER_PROFILE_REQUIRED');
  });
});

describe('profile and library', () => {
  it('updates the profile', async () => {
    const { actor } = await createUser(t);
    expect(await t.core.account.update(actor, { bio: 'Hafiz', country: 'PK' })).toMatchObject({
      bio: 'Hafiz',
      country: 'PK',
    });
  });

  it('returns liked recitations (approved only) and playlists', async () => {
    const { user: owner } = await createUser(t, { reciter: true });
    const { actor } = await createUser(t);
    const a = await insertRecitation(t, owner, { title: 'a' });
    const b = await insertRecitation(t, owner, { title: 'b' });
    await t.core.recitations.like(actor, a._id.toHexString());
    t.clock.advance(1000);
    await t.core.recitations.like(actor, b._id.toHexString());
    await t.db.database.models.Recitation.updateOne({ _id: a._id }, { status: 'removed' });
    await t.core.playlists.create(actor, {
      name: 'Night',
      isPublic: false,
      recitationIds: [b._id.toHexString()],
    });
    const library = await t.core.account.library(actor, { limit: 20 });
    expect(library.likes.items.map((r) => r.title)).toEqual(['b']);
    expect(library.playlists.map((p) => p.name)).toEqual(['Night']);
  });
});

describe('playlists', () => {
  it('creates, reads, updates and deletes, keeping private playlists private', async () => {
    const { user: owner } = await createUser(t, { reciter: true });
    const { actor } = await createUser(t);
    const { actor: other } = await createUser(t);
    const r = (await insertRecitation(t, owner))._id.toHexString();
    const created = await t.core.playlists.create(actor, {
      name: 'Fajr',
      isPublic: false,
      recitationIds: [r],
    });
    expect(created.recitationCount).toBe(1);
    expect(await errorCode(t.core.playlists.get(other, created.id))).toBe('NOT_FOUND');
    expect(await errorCode(t.core.playlists.update(other, created.id, { name: 'x' }))).toBe(
      'NOT_FOUND',
    );

    await t.core.playlists.update(actor, created.id, { isPublic: true });
    expect((await t.core.playlists.get(null, created.id)).recitations).toHaveLength(1);
    expect(await errorCode(t.core.playlists.update(other, created.id, { name: 'x' }))).toBe(
      'FORBIDDEN',
    );

    expect((await t.core.playlists.listMine(actor, { limit: 20 })).items).toHaveLength(1);
    await t.core.playlists.remove(actor, created.id);
    expect(await errorCode(t.core.playlists.get(actor, created.id))).toBe('NOT_FOUND');
  });

  it('refuses recitations that are not public', async () => {
    const { user: owner } = await createUser(t, { reciter: true });
    const { actor } = await createUser(t);
    const pending = (await insertRecitation(t, owner, { status: 'pending' }))._id.toHexString();
    expect(
      await errorCode(
        t.core.playlists.create(actor, { name: 'x', isPublic: false, recitationIds: [pending] }),
      ),
    ).toBe('NOT_FOUND');
  });
});

describe('account deletion', () => {
  it('requires a recent sign-in', async () => {
    const { actor } = await createUser(t);
    t.clock.advance(2 * DAY_MS);
    expect(await errorCode(t.core.account.deleteAccount(actor))).toBe('REAUTH_REQUIRED');
  });

  it('protects the last admin', async () => {
    const { actor } = await createUser(t, { role: 'admin' });
    expect(await errorCode(t.core.account.deleteAccount(actor))).toBe('CONFLICT');
  });

  it('deletes everything tied to the user, including recitations and their audio', async () => {
    const { user: owner, actor: ownerActor } = await createUser(t, { reciter: true });
    const { user, actor } = await createUser(t, { reciter: true });
    const theirs = await insertRecitation(t, owner, { likeCount: 0 });
    const mine = await insertRecitation(t, user);
    const mineId = mine._id.toHexString();
    await t.core.recitations.like(actor, theirs._id.toHexString());
    await t.core.recitations.like(ownerActor, mineId);
    await t.core.recitations.report(actor, theirs._id.toHexString(), { reason: 'other' });
    await t.core.recitations.report(ownerActor, mineId, { reason: 'other' });
    await t.core.recitations.recordPlay('listener-a', mineId);
    await t.core.playlists.create(actor, { name: 'p', isPublic: false, recitationIds: [] });
    const other = await t.core.playlists.create(ownerActor, {
      name: 'q',
      isPublic: false,
      recitationIds: [mineId, theirs._id.toHexString()],
    });

    await t.core.account.deleteAccount(actor);

    const { models } = t.db.database;
    expect(await models.User.findById(user._id)).toBeNull();
    expect(await models.Recitation.findById(mine._id)).toBeNull();
    expect(t.storage.objects.has(mine.audioKey)).toBe(false);
    expect(await models.Playlist.countDocuments({ ownerId: user._id })).toBe(0);
    expect(await models.Like.countDocuments({ recitationId: mine._id })).toBe(0);
    expect(await models.Like.countDocuments({ userId: user._id })).toBe(0);
    expect(await models.Report.countDocuments({ reporterId: user._id })).toBe(0);
    expect(await models.Report.countDocuments({ recitationId: mine._id })).toBe(0);
    expect(await models.PlayStatDaily.countDocuments({ recitationId: mine._id })).toBe(0);
    expect((await models.Recitation.findById(theirs._id).lean())?.likeCount).toBe(0);
    const kept = await models.Playlist.findById(other.id).lean();
    expect(kept?.recitationIds.map(String)).toEqual([theirs._id.toHexString()]);
  });

  it('keeps a recitation hidden until a failed audio delete succeeds, then cleans it up', async () => {
    const { user, actor } = await createUser(t, { reciter: true });
    const mine = await insertRecitation(t, user);
    t.storage.failDeletes = true;
    await t.core.account.deleteAccount(actor);
    const { models } = t.db.database;
    expect((await models.Recitation.findById(mine._id).lean())?.status).toBe('removed');
    expect(t.storage.objects.has(mine.audioKey)).toBe(true);

    t.storage.failDeletes = false;
    await t.core.maintenance.purgeAudio();
    expect(await t.core.maintenance.cleanUp()).toEqual({ recitations: 1, authRecords: 0 });
    expect(t.storage.objects.has(mine.audioKey)).toBe(false);
    expect(await models.Recitation.findById(mine._id)).toBeNull();
  });

  it('removes sign-in links and sessions left by a user deleted outside the app', async () => {
    const { user } = await createUser(t);
    const { user: keep } = await createUser(t);
    const { db, models } = t.db.database;
    await db.collection('accounts').insertMany([
      { providerId: 'google', accountId: 'g-1', userId: user._id },
      { providerId: 'google', accountId: 'g-2', userId: keep._id.toHexString() },
    ]);
    await db.collection('sessions').insertOne({ token: 's', userId: user._id });
    await models.User.deleteOne({ _id: user._id }); // as if deleted in Atlas

    expect(await t.core.maintenance.cleanUp()).toEqual({ recitations: 0, authRecords: 2 });
    expect(await db.collection('accounts').countDocuments()).toBe(1);
    expect(await db.collection('sessions').countDocuments()).toBe(0);
  });
});
