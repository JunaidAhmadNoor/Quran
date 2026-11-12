import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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

async function setup() {
  const { user: owner, actor: ownerActor } = await createUser(t, { reciter: true });
  const { actor: listener } = await createUser(t);
  const { actor: moderator } = await createUser(t, { role: 'moderator' });
  const pending = await insertRecitation(t, owner, { status: 'pending' });
  return { owner, ownerActor, listener, moderator, id: pending._id.toHexString(), pending };
}

describe('moderation decisions', () => {
  it('does not let a listener approve', async () => {
    const { listener, id } = await setup();
    expect(
      await errorCode(t.core.moderation.decideRecitation(listener, id, { decision: 'approve' })),
    ).toBe('FORBIDDEN');
    expect(
      await errorCode(t.core.moderation.queue(listener, { kind: 'recitations', limit: 20 })),
    ).toBe('FORBIDDEN');
  });

  it('approves a pending upload so it appears in public lists', async () => {
    const { moderator, id } = await setup();
    const approved = await t.core.moderation.decideRecitation(moderator, id, {
      decision: 'approve',
    });
    expect(approved.status).toBe('approved');
    const publicList = await t.core.recitations.list(null, {
      surah: 112,
      sort: 'newest',
      limit: 20,
    });
    expect(publicList.items.map((r) => r.id)).toEqual([id]);
  });

  it('rejects with a reason the uploader can read, and refuses an invalid transition', async () => {
    const { moderator, ownerActor, id } = await setup();
    await t.core.moderation.decideRecitation(moderator, id, {
      decision: 'reject',
      reason: 'Wrong surah',
    });
    expect((await t.core.recitations.get(ownerActor, id)).moderationNote).toBe('Wrong surah');
    expect(
      await errorCode(
        t.core.moderation.decideRecitation(moderator, id, { decision: 'reject', reason: 'again' }),
      ),
    ).toBe('CONFLICT');
    // A rejected recitation can still be approved on appeal.
    expect(
      (await t.core.moderation.decideRecitation(moderator, id, { decision: 'approve' })).status,
    ).toBe('approved');
  });

  it('removes an approved recitation, resolves its open reports and deletes the audio', async () => {
    const { owner, listener, moderator } = await setup();
    const live = await insertRecitation(t, owner);
    const id = live._id.toHexString();
    await t.core.recitations.report(listener, id, { reason: 'copyright' });
    await t.core.moderation.decideRecitation(moderator, id, {
      decision: 'remove',
      reason: 'Copyright claim',
      resolveReports: true,
    });
    expect(t.storage.objects.has(live.audioKey)).toBe(false);
    const queue = await t.core.moderation.queue(moderator, { kind: 'reports', limit: 20 });
    expect(queue.items).toHaveLength(0);
    expect(queue.counts.openReports).toBe(0);
  });

  it('returns NOT_FOUND for an unknown recitation', async () => {
    const { moderator } = await setup();
    expect(
      await errorCode(
        t.core.moderation.decideRecitation(moderator, '665f1c2e9b1d4a0012ab34cd', {
          decision: 'approve',
        }),
      ),
    ).toBe('NOT_FOUND');
  });
});

describe('moderation queue', () => {
  it('lists pending uploads oldest first with open report counts and totals', async () => {
    const { owner, moderator, id } = await setup();
    t.clock.advance(1000);
    await insertRecitation(t, owner, { status: 'pending', title: 'second' });
    const queue = await t.core.moderation.queue(moderator, { kind: 'recitations', limit: 20 });
    expect(queue.kind).toBe('recitations');
    expect(queue.items[0]?.id).toBe(id);
    expect(queue.items[0]).toMatchObject({ openReportCount: 0 });
    expect(queue.counts).toEqual({ pendingRecitations: 2, openReports: 0 });
  });

  it('lists open reports and lets a moderator dismiss one once', async () => {
    const { owner, listener, moderator } = await setup();
    const live = await insertRecitation(t, owner);
    await t.core.recitations.report(listener, live._id.toHexString(), {
      reason: 'other',
      note: 'Music in background',
    });
    const queue = await t.core.moderation.queue(moderator, { kind: 'reports', limit: 20 });
    if (queue.kind !== 'reports') throw new Error('expected reports');
    const report = queue.items[0];
    expect(report).toMatchObject({ reason: 'other', note: 'Music in background', status: 'open' });
    const closed = await t.core.moderation.decideReport(moderator, report?.id ?? '', {
      decision: 'dismissed',
      note: 'Fine',
    });
    expect(closed.resolution).toMatchObject({ note: 'Fine', decidedBy: { id: moderator.userId } });
    expect(
      await errorCode(
        t.core.moderation.decideReport(moderator, report?.id ?? '', { decision: 'actioned' }),
      ),
    ).toBe('CONFLICT');
  });
});

describe('admin', () => {
  it('grants the verified badge, which also turns on the reciter profile', async () => {
    const { actor: admin } = await createUser(t, { role: 'admin' });
    const { user } = await createUser(t);
    const found = await t.core.admin.findUsers(admin, { email: user.email.toUpperCase() });
    expect(found.items).toHaveLength(1);
    const updated = await t.core.admin.updateUser(admin, user._id.toHexString(), {
      verifiedReciter: true,
    });
    expect(updated.verifiedReciter).toBe(true);
    expect(updated.reciterSince).not.toBeNull();
  });

  it('stops moderators from administering and admins from changing their own role', async () => {
    const { actor: admin } = await createUser(t, { role: 'admin' });
    const { actor: moderator } = await createUser(t, { role: 'moderator' });
    expect(
      await errorCode(t.core.admin.updateUser(moderator, admin.userId, { role: 'user' })),
    ).toBe('FORBIDDEN');
    expect(await errorCode(t.core.admin.updateUser(admin, admin.userId, { role: 'user' }))).toBe(
      'CONFLICT',
    );
    expect((await t.core.admin.updateUser(admin, moderator.userId, { role: 'user' })).role).toBe(
      'user',
    );
  });
});
