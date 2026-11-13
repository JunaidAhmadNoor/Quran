import type { Connection, Models } from '@tilawah/db';
import { DAY_MS, utcDay } from '../clock';
import type { CursorState } from '../cursor';
import { afterCursor, oid } from './keyset';

const isDuplicateKey = (error: unknown) => (error as { code?: number }).code === 11000;

/** Likes and their denormalized counter, kept consistent with a transaction. */
export class LikeRepository {
  constructor(
    private readonly models: Models,
    private readonly connection: Connection,
  ) {}

  /** Returns the like count after the operation. Idempotent. */
  async like(userId: string, recitationId: string): Promise<number> {
    const key = { userId: oid(userId), recitationId: oid(recitationId) };
    const session = await this.connection.startSession();
    try {
      // A duplicate-key error aborts a transaction, so check first; a concurrent second like
      // that still collides is caught below and means "already liked".
      await session.withTransaction(async () => {
        if (await this.models.Like.exists(key).session(session)) return;
        await this.models.Like.create([key], { session });
        await this.models.Recitation.updateOne(
          { _id: key.recitationId },
          { $inc: { likeCount: 1 } },
          { session },
        );
      });
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
    } finally {
      await session.endSession();
    }
    return this.count(recitationId);
  }

  async unlike(userId: string, recitationId: string): Promise<number> {
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const { deletedCount } = await this.models.Like.deleteOne(
          { userId: oid(userId), recitationId: oid(recitationId) },
          { session },
        );
        if (deletedCount === 1) {
          await this.models.Recitation.updateOne(
            { _id: oid(recitationId), likeCount: { $gt: 0 } },
            { $inc: { likeCount: -1 } },
            { session },
          );
        }
      });
    } finally {
      await session.endSession();
    }
    return this.count(recitationId);
  }

  async likedIds(userId: string, recitationIds: string[]): Promise<Set<string>> {
    const rows = await this.models.Like.find(
      { userId: oid(userId), recitationId: { $in: recitationIds.map(oid) } },
      { recitationId: 1 },
    ).lean();
    return new Set(rows.map((r) => r.recitationId.toHexString()));
  }

  listByUser(userId: string, cursor: CursorState | null, limit: number) {
    return this.models.Like.find({ userId: oid(userId), ...afterCursor('createdAt', -1, cursor) })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();
  }

  /** Removes all of a user's likes and gives the counters back. */
  async deleteByUser(userId: string): Promise<void> {
    const likes = await this.models.Like.find({ userId: oid(userId) }, { recitationId: 1 }).lean();
    if (likes.length === 0) return;
    await this.models.Recitation.updateMany(
      { _id: { $in: likes.map((l) => l.recitationId) }, likeCount: { $gt: 0 } },
      { $inc: { likeCount: -1 } },
    );
    await this.models.Like.deleteMany({ userId: oid(userId) });
  }

  private async count(recitationId: string): Promise<number> {
    const doc = await this.models.Recitation.findById(oid(recitationId), { likeCount: 1 }).lean();
    return doc?.likeCount ?? 0;
  }
}

/** Play de-duplication markers and daily play buckets. */
export class PlayRepository {
  constructor(private readonly models: Models) {}

  /** True if this listener has not been counted for this recitation within the window. */
  async claimPlay(
    recitationId: string,
    listener: string,
    now: Date,
    windowMs: number,
  ): Promise<boolean> {
    const _id = `play:${recitationId}:${listener}`;
    const expiresAt = new Date(now.getTime() + windowMs);
    // Matches a missing marker (upsert) or one that has expired but not yet been TTL-deleted.
    try {
      const result = await this.models.RateLimit.updateOne(
        { _id, expiresAt: { $lte: now } },
        { $set: { count: 1, expiresAt } },
        { upsert: true },
      );
      return result.upsertedCount === 1 || result.modifiedCount === 1;
    } catch (error) {
      if (isDuplicateKey(error)) return false;
      throw error;
    }
  }

  async recordDaily(recitationId: string, now: Date): Promise<void> {
    const day = utcDay(now);
    await this.models.PlayStatDaily.updateOne(
      { recitationId: oid(recitationId), day },
      { $inc: { plays: 1 }, $setOnInsert: { expiresAt: new Date(Date.parse(day) + 8 * DAY_MS) } },
      { upsert: true },
    );
  }

  /** All plays counted since a UTC day (admin overview). */
  async totalSince(sinceDay: string): Promise<number> {
    const [row] = await this.models.PlayStatDaily.aggregate<{ total: number }>([
      { $match: { day: { $gte: sinceDay } } },
      { $group: { _id: null, total: { $sum: '$plays' } } },
    ]);
    return row?.total ?? 0;
  }

  async playsSince(recitationIds: string[], sinceDay: string): Promise<number> {
    if (recitationIds.length === 0) return 0;
    const [row] = await this.models.PlayStatDaily.aggregate<{ total: number }>([
      { $match: { recitationId: { $in: recitationIds.map(oid) }, day: { $gte: sinceDay } } },
      { $group: { _id: null, total: { $sum: '$plays' } } },
    ]);
    return row?.total ?? 0;
  }
}
