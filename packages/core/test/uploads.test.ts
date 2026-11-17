import { MAX_UPLOAD_BYTES, STORAGE_QUOTA_BYTES } from '@tilawah/contracts';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Actor } from '../src/actor';
import type { DomainError } from '../src/errors';
import { createUser, insertRecitation, startTestCore, type TestCore } from '../src/testing';

let t: TestCore;
beforeAll(async () => {
  t = await startTestCore();
});
afterAll(() => t.stop());
beforeEach(() => t.reset());

const body = {
  surah: 112,
  ayahFrom: 1,
  ayahTo: 4,
  contentType: 'audio/mpeg',
  sizeBytes: 500_000,
  rightsConfirmed: true as const,
};
const meta = {
  title: 'Al-Ikhlas',
  style: 'murattal' as const,
  riwayah: 'hafs' as const,
  durationSec: 30,
  visibility: 'public' as const,
};

const errorCode = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return (e as DomainError).code;
  }
  return 'NO_ERROR';
};

/** presign → simulated client PUT → confirm */
async function upload(actor: Actor, overrides: { put?: boolean; putSize?: number } = {}) {
  const presigned = await t.core.uploads.presign(actor, body);
  const key = new URL(presigned.uploadUrl).pathname.slice(1);
  if (overrides.put !== false)
    t.storage.put(key, overrides.putSize ?? body.sizeBytes, 'audio/mpeg');
  return {
    presigned,
    key,
    confirm: () => t.core.uploads.confirm(actor, { uploadToken: presigned.uploadToken, ...meta }),
  };
}

describe('presign', () => {
  it('returns a PUT URL valid for 10 minutes and a signed token', async () => {
    const { actor } = await createUser(t, { reciter: true });
    const res = await t.core.uploads.presign(actor, body);
    expect(res.method).toBe('PUT');
    expect(res.uploadUrl).toContain(`incoming/${actor.userId}/`);
    expect(res.headers).toEqual({ 'Content-Type': 'audio/mpeg' });
    expect(Date.parse(res.expiresAt) - t.clock.now().getTime()).toBe(10 * 60 * 1000);
  });

  it.each([
    ['wrong file type', { contentType: 'video/mp4' }, 'UNSUPPORTED_MEDIA_TYPE'],
    ['too large', { sizeBytes: MAX_UPLOAD_BYTES + 1 }, 'FILE_TOO_LARGE'],
    ['too small', { sizeBytes: 10 }, 'VALIDATION_ERROR'],
    ['ayah range past the surah end', { ayahTo: 5 }, 'INVALID_AYAH_RANGE'],
  ])('rejects %s', async (_label, patch, expected) => {
    const { actor } = await createUser(t, { reciter: true });
    expect(await errorCode(t.core.uploads.presign(actor, { ...body, ...patch }))).toBe(expected);
  });

  it('requires the reciter profile (switch to reciter mode first)', async () => {
    const { actor } = await createUser(t);
    expect(await errorCode(t.core.uploads.presign(actor, body))).toBe('RECITER_PROFILE_REQUIRED');
  });

  it('enforces the storage quota', async () => {
    const { user, actor } = await createUser(t, { reciter: true });
    await insertRecitation(t, user, { sizeBytes: STORAGE_QUOTA_BYTES - 100_000 });
    expect(await errorCode(t.core.uploads.presign(actor, body))).toBe('QUOTA_EXCEEDED');
  });
});

describe('confirm', () => {
  it('creates a pending recitation and moves the file out of incoming/', async () => {
    const { actor } = await createUser(t, { reciter: true });
    const { key, confirm } = await upload(actor);
    const rec = await confirm();
    expect(rec.status).toBe('pending');
    expect(rec.sizeBytes).toBe(body.sizeBytes);
    expect(t.storage.objects.has(key)).toBe(false);
    expect(t.storage.objects.has(`audio/${rec.id}.mp3`)).toBe(true);
  });

  it('approves verified reciters immediately (they skip the queue)', async () => {
    const { actor } = await createUser(t, { verifiedReciter: true });
    expect((await (await upload(actor)).confirm()).status).toBe('approved');
  });

  it('does not approve someone who merely switched to reciter mode', async () => {
    const { actor } = await createUser(t, { reciter: true });
    expect((await (await upload(actor)).confirm()).status).toBe('pending');
  });

  it('fails with UPLOAD_EXPIRED after the token expires', async () => {
    const { actor } = await createUser(t, { reciter: true });
    const { confirm } = await upload(actor);
    t.clock.advance(71 * 60 * 1000);
    expect(await errorCode(confirm())).toBe('UPLOAD_EXPIRED');
  });

  it('fails with UPLOAD_NOT_FOUND when nothing was uploaded', async () => {
    const { actor } = await createUser(t, { reciter: true });
    expect(await errorCode((await upload(actor, { put: false })).confirm())).toBe(
      'UPLOAD_NOT_FOUND',
    );
  });

  it('fails with UPLOAD_MISMATCH when the stored size differs, and deletes the object', async () => {
    const { actor } = await createUser(t, { reciter: true });
    const { key, confirm } = await upload(actor, { putSize: 123_456 });
    expect(await errorCode(confirm())).toBe('UPLOAD_MISMATCH');
    expect(t.storage.objects.has(key)).toBe(false);
  });

  it('rejects confirming the same token twice', async () => {
    const { actor } = await createUser(t, { reciter: true });
    const { confirm } = await upload(actor);
    await confirm();
    expect(await errorCode(confirm())).toBe('CONFLICT');
  });

  it('rejects another user’s token', async () => {
    const { actor } = await createUser(t, { reciter: true });
    const { actor: other } = await createUser(t, { reciter: true });
    const { presigned } = await upload(actor);
    expect(
      await errorCode(
        t.core.uploads.confirm(other, { uploadToken: presigned.uploadToken, ...meta }),
      ),
    ).toBe('FORBIDDEN');
  });

  it('rejects a duration that cannot match the file size', async () => {
    const { actor } = await createUser(t, { reciter: true });
    const { presigned } = await upload(actor);
    const res = t.core.uploads.confirm(actor, {
      uploadToken: presigned.uploadToken,
      ...meta,
      durationSec: 100_000,
    });
    expect(await errorCode(res)).toBe('VALIDATION_ERROR');
  });
});

describe('private recitations', () => {
  it('stay with the uploader, skip review, and can be published later', async () => {
    const { actor } = await createUser(t, { reciter: true });
    const { actor: listener } = await createUser(t);
    const { actor: moderator } = await createUser(t, { role: 'moderator' });
    const { presigned } = await upload(actor);
    const created = await t.core.uploads.confirm(actor, {
      uploadToken: presigned.uploadToken,
      ...meta,
      visibility: 'private',
    });
    expect(created.status).toBe('private');
    expect((await t.core.recitations.get(actor, created.id)).stream.url).toBeTruthy();
    expect(await errorCode(t.core.recitations.get(listener, created.id))).toBe('NOT_FOUND');
    expect(await errorCode(t.core.recitations.get(moderator, created.id))).toBe('NOT_FOUND');
    const queue = await t.core.moderation.queue(moderator, { kind: 'recitations', limit: 20 });
    expect(queue.counts.pendingRecitations).toBe(0);
    expect((await t.core.account.reciterStats(actor)).recitations.private).toBe(1);

    const published = await t.core.recitations.update(actor, created.id, { visibility: 'public' });
    expect(published.status).toBe('pending');
    const hidden = await t.core.recitations.update(actor, created.id, { visibility: 'private' });
    expect(hidden.status).toBe('private');
  });

  it('publishes at once for verified reciters and hides approved ones again', async () => {
    const { user, actor } = await createUser(t, { verifiedReciter: true });
    const { actor: listener } = await createUser(t);
    const doc = await insertRecitation(t, user, { status: 'private' });
    const id = doc._id.toHexString();
    expect((await t.core.recitations.update(actor, id, { visibility: 'public' })).status).toBe(
      'approved',
    );
    expect((await t.core.recitations.get(listener, id)).id).toBe(id);
    await t.core.recitations.update(actor, id, { visibility: 'private' });
    expect(await errorCode(t.core.recitations.get(listener, id))).toBe('NOT_FOUND');
  });

  it('only the uploader changes visibility, and not for rejected recitations', async () => {
    const { user, actor } = await createUser(t, { reciter: true });
    const { actor: moderator } = await createUser(t, { role: 'moderator' });
    const pending = await insertRecitation(t, user, { status: 'pending' });
    const rejected = await insertRecitation(t, user, { status: 'rejected' });
    expect(
      await errorCode(
        t.core.recitations.update(moderator, pending._id.toHexString(), { visibility: 'private' }),
      ),
    ).toBe('FORBIDDEN');
    expect(
      await errorCode(
        t.core.recitations.update(actor, rejected._id.toHexString(), { visibility: 'private' }),
      ),
    ).toBe('CONFLICT');
  });
});
