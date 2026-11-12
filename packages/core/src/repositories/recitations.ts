import type {
  RecitationSort,
  RecitationStatus,
  RecitationStyle,
  Riwayah,
} from '@tilawah/contracts';
import type { ClientSession, Models, RecitationDoc } from '@tilawah/db';
import type { CursorState } from '../cursor';
import { afterCursor, oid } from './keyset';

export interface PublicFilters {
  surah?: number | undefined;
  reciterId?: string | undefined;
  style?: RecitationStyle | undefined;
  riwayah?: Riwayah | undefined;
}

const SORT_FIELD = { newest: 'createdAt', popular: 'playCount' } as const;

export class RecitationRepository {
  constructor(private readonly models: Models) {}

  findById(id: string): Promise<RecitationDoc | null> {
    return this.models.Recitation.findById(oid(id)).lean<RecitationDoc>();
  }

  findByIds(ids: string[]): Promise<RecitationDoc[]> {
    return this.models.Recitation.find({ _id: { $in: ids.map(oid) } }).lean<RecitationDoc[]>();
  }

  async insert(doc: Omit<RecitationDoc, 'createdAt' | 'updatedAt'>): Promise<RecitationDoc> {
    const created = await this.models.Recitation.create(doc);
    return created.toObject<RecitationDoc>();
  }

  update(id: string, set: Partial<RecitationDoc>): Promise<RecitationDoc | null> {
    return this.models.Recitation.findByIdAndUpdate(
      oid(id),
      { $set: set },
      { returnDocument: 'after' },
    ).lean<RecitationDoc>();
  }

  /** Changes status only if the current status is one of `from` (guards concurrent moderators). */
  transition(
    id: string,
    from: RecitationStatus[],
    set: Partial<RecitationDoc>,
    session?: ClientSession,
  ): Promise<RecitationDoc | null> {
    return this.models.Recitation.findOneAndUpdate(
      { _id: oid(id), status: { $in: from } },
      { $set: set },
      { returnDocument: 'after', session: session ?? null },
    ).lean<RecitationDoc>();
  }

  /** Approved recitations, keyset-paginated for newest and popular. */
  listApproved(
    filters: PublicFilters,
    sort: Exclude<RecitationSort, 'trending'>,
    cursor: CursorState | null,
    limit: number,
  ): Promise<RecitationDoc[]> {
    const field = SORT_FIELD[sort];
    return this.models.Recitation.find({
      status: 'approved',
      ...this.filterQuery(filters),
      ...afterCursor(field, -1, cursor),
    })
      .sort({ [field]: -1, _id: -1 })
      .limit(limit + 1)
      .lean<RecitationDoc[]>();
  }

  /** Approved recitations ranked by plays since `sinceDay`, offset-paginated. */
  async listTrending(filters: PublicFilters, sinceDay: string, offset: number, limit: number) {
    const rows = await this.models.PlayStatDaily.aggregate<{ doc: RecitationDoc }>([
      { $match: { day: { $gte: sinceDay } } },
      { $group: { _id: '$recitationId', plays: { $sum: '$plays' } } },
      { $lookup: { from: 'recitations', localField: '_id', foreignField: '_id', as: 'doc' } },
      { $unwind: '$doc' },
      { $match: { 'doc.status': 'approved', ...prefix(this.filterQuery(filters), 'doc.') } },
      { $sort: { plays: -1, _id: -1 } },
      { $skip: offset },
      { $limit: limit + 1 },
      { $project: { doc: 1 } },
    ]);
    return rows.map((r) => r.doc);
  }

  listByUploader(
    uploaderId: string,
    status: RecitationStatus | undefined,
    cursor: CursorState | null,
    limit: number,
  ): Promise<RecitationDoc[]> {
    return this.models.Recitation.find({
      uploaderId: oid(uploaderId),
      ...(status ? { status } : {}),
      ...afterCursor('createdAt', -1, cursor),
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean<RecitationDoc[]>();
  }

  listPending(cursor: CursorState | null, limit: number): Promise<RecitationDoc[]> {
    return this.models.Recitation.find({
      status: 'pending',
      ...afterCursor('createdAt', 1, cursor),
    })
      .sort({ createdAt: 1, _id: 1 })
      .limit(limit + 1)
      .lean<RecitationDoc[]>();
  }

  countPending(): Promise<number> {
    return this.models.Recitation.countDocuments({ status: 'pending' });
  }

  async incPlayCount(id: string): Promise<number> {
    const doc = await this.models.Recitation.findByIdAndUpdate(
      oid(id),
      { $inc: { playCount: 1 } },
      { returnDocument: 'after', projection: { playCount: 1 } },
    ).lean();
    return doc?.playCount ?? 0;
  }

  /** Bytes of audio a user currently keeps in storage. */
  async storageUsed(uploaderId: string): Promise<number> {
    const [row] = await this.models.Recitation.aggregate<{ total: number }>([
      { $match: { uploaderId: oid(uploaderId), audioDeletedAt: null, status: { $ne: 'removed' } } },
      { $group: { _id: null, total: { $sum: '$sizeBytes' } } },
    ]);
    return row?.total ?? 0;
  }

  /** Counts per status plus play/like totals for one uploader. */
  async uploaderStats(uploaderId: string) {
    const rows = await this.models.Recitation.aggregate<{
      _id: RecitationStatus;
      count: number;
      plays: number;
      likes: number;
    }>([
      { $match: { uploaderId: oid(uploaderId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          plays: { $sum: '$playCount' },
          likes: { $sum: '$likeCount' },
        },
      },
    ]);
    const by = (s: RecitationStatus) => rows.find((r) => r._id === s);
    const live = rows.filter((r) => r._id !== 'removed');
    return {
      pending: by('pending')?.count ?? 0,
      approved: by('approved')?.count ?? 0,
      rejected: by('rejected')?.count ?? 0,
      approvedPlays: by('approved')?.plays ?? 0,
      totalPlays: live.reduce((n, r) => n + r.plays, 0),
      totalLikes: live.reduce((n, r) => n + r.likes, 0),
    };
  }

  idsByUploader(uploaderId: string): Promise<RecitationDoc[]> {
    return this.models.Recitation.find({ uploaderId: oid(uploaderId) }).lean<RecitationDoc[]>();
  }

  /** Recitations whose audio is due for deletion: removed, or rejected before `rejectedBefore`. */
  audioToPurge(rejectedBefore: Date): Promise<RecitationDoc[]> {
    return this.models.Recitation.find({
      audioDeletedAt: null,
      $or: [{ status: 'removed' }, { status: 'rejected', moderatedAt: { $lt: rejectedBefore } }],
    })
      .limit(500)
      .lean<RecitationDoc[]>();
  }

  private filterQuery(filters: PublicFilters): Record<string, unknown> {
    return {
      ...(filters.surah !== undefined ? { surah: filters.surah } : {}),
      ...(filters.reciterId !== undefined ? { uploaderId: oid(filters.reciterId) } : {}),
      ...(filters.style !== undefined ? { style: filters.style } : {}),
      ...(filters.riwayah !== undefined ? { riwayah: filters.riwayah } : {}),
    };
  }
}

function prefix(query: Record<string, unknown>, p: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(query).map(([k, v]) => [`${p}${k}`, v]));
}
