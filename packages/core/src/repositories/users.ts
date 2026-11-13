import type { Models, UserDoc } from '@tilawah/db';
import type { CursorState } from '../cursor';
import { afterCursor, oid } from './keyset';

export class UserRepository {
  constructor(private readonly models: Models) {}

  findById(id: string): Promise<UserDoc | null> {
    return this.models.User.findById(oid(id)).lean<UserDoc>();
  }

  findByIds(ids: string[]): Promise<UserDoc[]> {
    return this.models.User.find({ _id: { $in: ids.map(oid) } }).lean<UserDoc[]>();
  }

  findByEmail(email: string): Promise<UserDoc | null> {
    return this.models.User.findOne({ email: email.toLowerCase() }).lean<UserDoc>();
  }

  update(id: string, set: Partial<UserDoc>): Promise<UserDoc | null> {
    return this.models.User.findByIdAndUpdate(
      oid(id),
      { $set: set },
      { returnDocument: 'after' },
    ).lean<UserDoc>();
  }

  /** Admin list: newest first, optional text search (name or email) and role. */
  listForAdmin(
    filters: { q?: string; role?: string },
    cursor: CursorState | null,
    limit: number,
  ): Promise<UserDoc[]> {
    const text = filters.q?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Text search and the cursor both use $or, so the conditions are combined with $and.
    const and: Record<string, unknown>[] = [afterCursor('createdAt', -1, cursor)];
    if (text)
      and.push({
        $or: [
          { name: { $regex: text, $options: 'i' } },
          { email: { $regex: text, $options: 'i' } },
        ],
      });
    if (filters.role) and.push({ role: filters.role });
    const filter: Record<string, unknown> = { $and: and };
    return this.models.User.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean<UserDoc[]>();
  }

  /** Totals for the admin overview, in one aggregation. */
  async adminCounts(since: Date) {
    const [row] = await this.models.User.aggregate<Record<string, number>>([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          reciters: {
            $sum: { $cond: [{ $ne: [{ $ifNull: ['$reciterSince', null] }, null] }, 1, 0] },
          },
          verifiedReciters: { $sum: { $cond: ['$verifiedReciter', 1, 0] } },
          moderators: { $sum: { $cond: [{ $eq: ['$role', 'moderator'] }, 1, 0] } },
          admins: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } },
          emailNotVerified: { $sum: { $cond: ['$emailVerified', 0, 1] } },
          newLast7Days: { $sum: { $cond: [{ $gte: ['$createdAt', since] }, 1, 0] } },
        },
      },
    ]);
    const n = (k: string) => row?.[k] ?? 0;
    return {
      total: n('total'),
      reciters: n('reciters'),
      verifiedReciters: n('verifiedReciters'),
      moderators: n('moderators'),
      admins: n('admins'),
      emailNotVerified: n('emailNotVerified'),
      newLast7Days: n('newLast7Days'),
    };
  }

  countAdmins(): Promise<number> {
    return this.models.User.countDocuments({ role: 'admin' });
  }

  listVerifiedReciters(cursor: CursorState | null, limit: number): Promise<UserDoc[]> {
    return this.models.User.find({
      verifiedReciter: true,
      reciterSince: { $ne: null },
      ...afterCursor('_id', 1, cursor),
    })
      .sort({ _id: 1 })
      .limit(limit + 1)
      .lean<UserDoc[]>();
  }

  /** Deletes the user and the Better Auth records that belong to them. */
  async deleteWithAuthRecords(id: string): Promise<void> {
    const userId = oid(id);
    const db = this.models.User.db;
    // Better Auth may store userId as an ObjectId or a string depending on version.
    const owned = { userId: { $in: [userId, id] } };
    await Promise.all([
      db.collection('sessions').deleteMany(owned),
      db.collection('accounts').deleteMany(owned),
      this.models.User.deleteOne({ _id: userId }),
    ]);
  }
}
