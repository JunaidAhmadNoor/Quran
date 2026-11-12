// Every /api/v1 endpoint, through its real route file. route() also validates each success
// response against its contract schema, so a passing call is a contract test too.
import { readFileSync } from 'node:fs';
import { endpoints, type EndpointName } from '@tilawah/contracts';
import { createUser, insertRecitation, type TestCore } from '@tilawah/core/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { call, fileFor, modules, startApp } from './harness';

let t: TestCore;
beforeAll(async () => {
  t = await startApp();
});
afterAll(() => t.stop());
beforeEach(() => t.reset());

const id = (doc: { _id: { toHexString(): string } }) => doc._id.toHexString();

describe('route files', () => {
  it.each(Object.entries(endpoints))('%s is exported by its route file', async (_name, e) => {
    const load = modules[fileFor(e.path)];
    expect(load, e.path).toBeDefined();
    const mod = await load?.();
    expect(typeof mod?.[e.method]).toBe('function');
    expect(typeof mod?.OPTIONS).toBe('function');
  });
});

describe('public endpoints', () => {
  it('GET /health', async () => {
    const res = await call('getHealth');
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ status: 'ok', apiVersion: '1.0.0' });
  });

  it('GET /surahs is cacheable for a day', async () => {
    const res = await call('listSurahs');
    expect(res.status).toBe(200);
    expect(res.json.items).toHaveLength(114);
    expect(res.headers.get('cache-control')).toContain('max-age=86400');
  });

  it('GET /surahs/{n} and /surahs/{n}/text', async () => {
    const { user } = await createUser(t, { reciter: true });
    await insertRecitation(t, user);
    const surah = await call('getSurah', { params: { n: 112 } });
    expect(surah.status).toBe(200);
    expect(surah.json.recitations.items).toHaveLength(1);
    const text = await call('getSurahText', { params: { n: 112 } });
    expect(text.json.ayahs).toHaveLength(4);
    expect((await call('getSurah', { params: { n: 115 } })).status).toBe(400);
  });

  it('GET /recitations and /recitations/{id}', async () => {
    const { user } = await createUser(t, { reciter: true });
    const rec = await insertRecitation(t, user);
    const list = await call('listRecitations', { query: { surah: 112, sort: 'popular' } });
    expect(list.json.items).toHaveLength(1);
    expect(list.headers.get('cache-control')).toContain('s-maxage=60');
    const one = await call('getRecitation', { params: { id: id(rec) } });
    expect(one.json.stream.url).toContain(rec.audioKey);
  });

  it('POST /recitations/{id}/play counts anonymous listeners by hashed IP', async () => {
    const { user } = await createUser(t, { reciter: true });
    const rec = await insertRecitation(t, user);
    const headers = { 'x-forwarded-for': '203.0.113.9' };
    expect((await call('recordPlay', { params: { id: id(rec) }, headers })).json).toEqual({
      counted: true,
      playCount: 1,
    });
    expect((await call('recordPlay', { params: { id: id(rec) }, headers })).json.counted).toBe(
      false,
    );
    const stored = await t.db.database.models.RateLimit.find().lean();
    expect(JSON.stringify(stored)).not.toContain('203.0.113.9');
  });

  it('GET /reciters and /reciters/{id}', async () => {
    const { user } = await createUser(t, { verifiedReciter: true });
    expect((await call('listReciters')).json.items).toHaveLength(1);
    expect(
      (await call('getReciter', { params: { id: id(user) } })).json.reciter.verifiedReciter,
    ).toBe(true);
  });
});

describe('signed-in endpoints', () => {
  it('rejects anonymous calls with 401 and the error envelope', async () => {
    const res = await call('getMe');
    expect(res.status).toBe(401);
    expect(res.error?.code).toBe('UNAUTHENTICATED');
    expect(res.error?.details).toEqual({});
    expect(res.error?.message).toBeTruthy();
  });

  it('GET/PATCH /me, PUT /me/mode, GET /me/reciter/stats', async () => {
    const { actor } = await createUser(t);
    const as = actor.userId;
    expect((await call('getMe', { as })).json.mode).toBe('listener');
    expect((await call('updateMe', { as, body: { bio: 'Student of Quran' } })).json.bio).toBe(
      'Student of Quran',
    );
    expect((await call('getReciterStats', { as })).error?.code).toBe('RECITER_PROFILE_REQUIRED');
    const switched = await call('switchMode', { as, body: { mode: 'reciter' } });
    expect(switched.json.mode).toBe('reciter');
    expect(switched.json.reciterSince).not.toBeNull();
    // Same session, no sign-out: the next request already sees reciter mode.
    expect((await call('getReciterStats', { as })).status).toBe(200);
  });

  it('ignores role and badge sent to PATCH /me', async () => {
    const { actor } = await createUser(t);
    const res = await call('updateMe', {
      as: actor.userId,
      body: { name: 'Ali', role: 'admin', verifiedReciter: true },
    });
    expect(res.json).toMatchObject({ name: 'Ali', role: 'user', verifiedReciter: false });
  });

  it('like, unlike, report, library and my recitations', async () => {
    const { user: owner, actor: ownerActor } = await createUser(t, { reciter: true });
    const { actor } = await createUser(t);
    const rec = await insertRecitation(t, owner);
    const params = { id: id(rec) };
    expect((await call('likeRecitation', { as: actor.userId, params })).json).toEqual({
      liked: true,
      likeCount: 1,
    });
    expect((await call('getLibrary', { as: actor.userId })).json.likes.items).toHaveLength(1);
    expect((await call('unlikeRecitation', { as: actor.userId, params })).json.likeCount).toBe(0);
    const report = await call('reportRecitation', {
      as: actor.userId,
      params,
      body: { reason: 'wrong_surah' },
    });
    expect(report.status).toBe(201);
    expect((await call('listMyRecitations', { as: ownerActor.userId })).json.items).toHaveLength(1);
  });

  it('uploads: presign, PUT, confirm', async () => {
    const { actor } = await createUser(t, { reciter: true });
    const presign = await call('presignUpload', {
      as: actor.userId,
      body: {
        surah: 112,
        ayahFrom: 1,
        ayahTo: 4,
        contentType: 'audio/mpeg',
        sizeBytes: 400_000,
        rightsConfirmed: true,
      },
    });
    expect(presign.status).toBe(200);
    t.storage.put(new URL(presign.json.uploadUrl).pathname.slice(1), 400_000, 'audio/mpeg');
    const created = await call('createRecitation', {
      as: actor.userId,
      body: {
        uploadToken: presign.json.uploadToken,
        title: 'Ikhlas',
        style: 'murattal',
        durationSec: 25,
      },
    });
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({ status: 'pending', riwayah: 'hafs' });
  });

  it('maps upload failures to their HTTP statuses', async () => {
    const { actor } = await createUser(t, { reciter: true });
    const base = {
      surah: 112,
      ayahFrom: 1,
      ayahTo: 4,
      contentType: 'audio/mpeg',
      sizeBytes: 400_000,
      rightsConfirmed: true,
    };
    const presign = (body: object) =>
      call('presignUpload', { as: actor.userId, body: { ...base, ...body } });
    expect((await presign({ contentType: 'video/mp4' })).status).toBe(415);
    expect((await presign({ sizeBytes: 61 * 1024 * 1024 })).status).toBe(413);
    expect((await presign({ ayahTo: 9 })).status).toBe(422);
    expect((await presign({ rightsConfirmed: false })).status).toBe(400);
  });

  it('PATCH and DELETE /recitations/{id}', async () => {
    const { user, actor } = await createUser(t, { reciter: true });
    const rec = await insertRecitation(t, user);
    const params = { id: id(rec) };
    expect(
      (await call('updateRecitation', { as: actor.userId, params, body: { title: 'Renamed' } }))
        .json.title,
    ).toBe('Renamed');
    const deleted = await call('deleteRecitation', { as: actor.userId, params });
    expect(deleted.status).toBe(204);
  });

  it('playlists CRUD', async () => {
    const { actor } = await createUser(t);
    const as = actor.userId;
    const created = await call('createPlaylist', { as, body: { name: 'Fajr' } });
    expect(created.status).toBe(201);
    const params = { id: created.json.id };
    expect((await call('listPlaylists', { as })).json.items).toHaveLength(1);
    expect((await call('getPlaylist', { as, params })).json.recitations).toEqual([]);
    expect(
      (await call('updatePlaylist', { as, params, body: { isPublic: true } })).json.isPublic,
    ).toBe(true);
    expect((await call('deletePlaylist', { as, params })).status).toBe(204);
  });

  it('memorization sessions and progress', async () => {
    const { actor } = await createUser(t);
    const as = actor.userId;
    const saved = await call('createMemorizationSession', {
      as,
      body: {
        surah: 112,
        ayahFrom: 1,
        ayahTo: 4,
        mode: 'reveal',
        wordsTotal: 15,
        wordsCorrect: 15,
        mistakes: [],
        startedAt: '2026-11-12T08:00:00.000Z',
        endedAt: '2026-11-12T08:01:00.000Z',
      },
    });
    expect(saved.status).toBe(201);
    expect((await call('getMemorizationProgress', { as })).json.items[0]).toMatchObject({
      surah: 112,
      bestAccuracy: 1,
    });
  });

  it('DELETE /me', async () => {
    const { actor } = await createUser(t);
    expect((await call('deleteMe', { as: actor.userId })).status).toBe(204);
    expect((await call('getMe', { as: actor.userId })).status).toBe(401);
  });
});

describe('staff endpoints', () => {
  it('forbids a listener from approving (403) and lets a moderator approve', async () => {
    const { user: owner } = await createUser(t, { reciter: true });
    const { actor: listener } = await createUser(t);
    const { actor: moderator } = await createUser(t, { role: 'moderator' });
    const rec = await insertRecitation(t, owner, { status: 'pending' });
    const params = { id: id(rec) };
    const denied = await call('decideRecitation', {
      as: listener.userId,
      params,
      body: { decision: 'approve' },
    });
    expect(denied.status).toBe(403);
    expect(
      (await call('getModerationQueue', { as: moderator.userId })).json.counts.pendingRecitations,
    ).toBe(1);
    const approved = await call('decideRecitation', {
      as: moderator.userId,
      params,
      body: { decision: 'approve' },
    });
    expect(approved.json.status).toBe('approved');
  });

  it('closes a report', async () => {
    const { user: owner } = await createUser(t, { reciter: true });
    const { actor } = await createUser(t);
    const { actor: moderator } = await createUser(t, { role: 'moderator' });
    const rec = await insertRecitation(t, owner);
    const report = await call('reportRecitation', {
      as: actor.userId,
      params: { id: id(rec) },
      body: { reason: 'not_quran' },
    });
    const closed = await call('decideReport', {
      as: moderator.userId,
      params: { id: report.json.id },
      body: { decision: 'dismissed' },
    });
    expect(closed.json.status).toBe('dismissed');
  });

  it('admin finds and updates users; moderators cannot', async () => {
    const { actor: admin } = await createUser(t, { role: 'admin' });
    const { actor: moderator } = await createUser(t, { role: 'moderator' });
    const { user } = await createUser(t);
    expect(
      (await call('findUsers', { as: moderator.userId, query: { email: user.email } })).status,
    ).toBe(403);
    expect(
      (await call('findUsers', { as: admin.userId, query: { email: user.email } })).json.items,
    ).toHaveLength(1);
    const updated = await call('updateUser', {
      as: admin.userId,
      params: { id: id(user) },
      body: { verifiedReciter: true },
    });
    expect(updated.json.verifiedReciter).toBe(true);
  });
});

describe('cross-cutting behaviour', () => {
  it('returns 400 with issues for invalid input', async () => {
    const res = await call('listRecitations', { query: { limit: 500 } });
    expect(res.status).toBe(400);
    expect(res.error?.code).toBe('VALIDATION_ERROR');
    expect(res.error?.details.issues).toEqual([expect.objectContaining({ path: ['limit'] })]);
  });

  it('blocks cookie-authenticated writes from other origins (CSRF)', async () => {
    const { user } = await createUser(t, { reciter: true });
    const rec = await insertRecitation(t, user);
    const res = await call('recordPlay', {
      params: { id: id(rec) },
      headers: { cookie: 'tilawah.session_token=x', origin: 'https://evil.example' },
    });
    expect(res.status).toBe(403);
    const ok = await call('recordPlay', {
      params: { id: id(rec) },
      headers: { cookie: 'tilawah.session_token=x', origin: 'http://localhost:3000' },
    });
    expect(ok.status).toBe(200);
  });

  it('rate-limits with 429 and Retry-After', async () => {
    const { user: owner } = await createUser(t, { reciter: true });
    const { actor } = await createUser(t);
    const rec = await insertRecitation(t, owner);
    for (let i = 0; i < 20; i++) await t.core.rateLimiter.consume('report', `user:${actor.userId}`);
    const res = await call('reportRecitation', {
      as: actor.userId,
      params: { id: id(rec) },
      body: { reason: 'other', note: 'x' },
    });
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('never shares personalised responses through caches', async () => {
    const { actor } = await createUser(t);
    const res = await call('listRecitations', { as: actor.userId });
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('vary')).toContain('Authorization');
  });

  it('adds CORS headers only for allowed origins', async () => {
    const allowed = await call('listSurahs', { headers: { origin: 'http://localhost:3000' } });
    expect(allowed.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
    const other = await call('listSurahs', { headers: { origin: 'https://evil.example' } });
    expect(other.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('calls every endpoint somewhere in this file', () => {
    const source = readFileSync(new URL(import.meta.url), 'utf8');
    const missing = (Object.keys(endpoints) as EndpointName[]).filter(
      (name) => !source.includes(`call('${name}'`),
    );
    expect(missing).toEqual([]);
  });
});
