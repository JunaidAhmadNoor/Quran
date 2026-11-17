// The spec's main story at the API level (the browser version arrives with the pages in Phase 3):
// upload → moderator approves → appears on the surah page → another user plays and likes it.
import { createUser, type TestCore } from '@tilawah/core/testing';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { call, startApp } from './harness';

let t: TestCore;
beforeAll(async () => {
  t = await startApp();
});
afterAll(() => t.stop());

it('takes a recitation from upload to likes', async () => {
  const { actor: reciter } = await createUser(t);
  const { actor: moderator } = await createUser(t, { role: 'moderator' });
  const { actor: listener } = await createUser(t);

  // A listener account switches to reciter mode (no new session) and uploads.
  await call('switchMode', { as: reciter.userId, body: { mode: 'reciter' } });
  const presign = await call('presignUpload', {
    as: reciter.userId,
    body: {
      surah: 1,
      ayahFrom: 1,
      ayahTo: 7,
      contentType: 'audio/mp4',
      sizeBytes: 900_000,
      rightsConfirmed: true,
    },
  });
  t.storage.put(new URL(presign.json.uploadUrl).pathname.slice(1), 900_000, 'audio/mp4');
  const created = await call('createRecitation', {
    as: reciter.userId,
    body: {
      uploadToken: presign.json.uploadToken,
      title: 'Al-Fatihah',
      style: 'murattal',
      durationSec: 60,
    },
  });
  const id = created.json.id;

  // Not public yet.
  expect(
    (await call('getSurah', { params: { n: 1 }, as: listener.userId })).json.recitations.items,
  ).toHaveLength(0);
  expect((await call('getRecitation', { params: { id }, as: listener.userId })).status).toBe(404);

  // Moderator approves it.
  const queue = await call('getModerationQueue', { as: moderator.userId });
  expect(queue.json.items.map((r) => r.id)).toEqual([id]);
  await call('decideRecitation', {
    as: moderator.userId,
    params: { id },
    body: { decision: 'approve' },
  });

  // Now on the surah page; another user plays and likes it.
  const surah = await call('getSurah', { params: { n: 1 }, as: listener.userId });
  expect(surah.json.recitations.items[0]).toMatchObject({
    id,
    title: 'Al-Fatihah',
    status: 'approved',
  });
  expect((await call('recordPlay', { params: { id }, as: listener.userId })).json).toEqual({
    counted: true,
    playCount: 1,
  });
  expect((await call('likeRecitation', { params: { id }, as: listener.userId })).json).toEqual({
    liked: true,
    likeCount: 1,
  });

  // The reciter's dashboard reflects it.
  const stats = await call('getReciterStats', { as: reciter.userId });
  expect(stats.json).toMatchObject({
    recitations: { approved: 1, pending: 0 },
    totalPlays: 1,
    totalLikes: 1,
  });
});
