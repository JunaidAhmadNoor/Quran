import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestDatabase, type TestDatabase } from '../src/testing';

let t: TestDatabase;
beforeAll(async () => {
  t = await startTestDatabase();
}, 120_000);
afterAll(async () => {
  await t.stop();
});

const indexNames = async (collection: string) =>
  (await t.database.db.collection(collection).indexes()).map((i) => JSON.stringify(i.key));

describe('indexes', () => {
  it('enforces the uniqueness rules the services rely on', async () => {
    expect(await indexNames('users')).toContain('{"email":1}');
    expect(await indexNames('likes')).toContain('{"userId":1,"recitationId":1}');
    expect(await indexNames('recitations')).toContain('{"audioKey":1}');
    expect(await indexNames('memorizationProgress')).toContain('{"userId":1,"surah":1}');
  });

  it('expires rate-limit records and old sessions', async () => {
    const ttl = (await t.database.db.collection('rateLimits').indexes()).find(
      (i) => i.expireAfterSeconds === 0,
    );
    expect(ttl?.key).toEqual({ expiresAt: 1 });
  });

  it('rejects a second like for the same user and recitation', async () => {
    const { Like, User } = t.database.models;
    const user = await User.create({ name: 'A', email: 'a@example.com' });
    const recitationId = new t.database.connection.base.Types.ObjectId();
    await Like.create({ userId: user._id, recitationId });
    await expect(Like.create({ userId: user._id, recitationId })).rejects.toThrow(/duplicate key/);
  });

  it('supports transactions (replica set)', async () => {
    const session = await t.database.connection.startSession();
    await session.withTransaction(async () => {
      await t.database.models.User.create([{ name: 'B', email: 'b@example.com' }], { session });
    });
    await session.endSession();
    expect(await t.database.models.User.countDocuments({ email: 'b@example.com' })).toBe(1);
  });
});
