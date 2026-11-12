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
