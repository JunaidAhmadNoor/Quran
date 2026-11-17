import type { Models, PlaylistDoc, ReportDoc } from '@tilawah/db';
import type { ReportStatus } from '@tilawah/contracts';
import type { CursorState } from '../cursor';
import { afterCursor, oid } from './keyset';

export class PlaylistRepository {
  constructor(private readonly models: Models) {}

  findById(id: string): Promise<PlaylistDoc | null> {
    return this.models.Playlist.findById(oid(id)).lean<PlaylistDoc>();
  }

  listByOwner(ownerId: string, cursor: CursorState | null, limit: number): Promise<PlaylistDoc[]> {
    return this.models.Playlist.find({
      ownerId: oid(ownerId),
      ...afterCursor('updatedAt', -1, cursor),
    })
      .sort({ updatedAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean<PlaylistDoc[]>();
  }

  countByOwner(ownerId: string): Promise<number> {
    return this.models.Playlist.countDocuments({ ownerId: oid(ownerId) });
  }

  async insert(doc: { ownerId: string; name: string; isPublic: boolean; recitationIds: string[] }) {
    const created = await this.models.Playlist.create({
      ...doc,
      ownerId: oid(doc.ownerId),
      recitationIds: doc.recitationIds.map(oid),
    });
    return created.toObject<PlaylistDoc>();
  }

  update(id: string, set: { name?: string; isPublic?: boolean; recitationIds?: string[] }) {
    const { recitationIds, ...rest } = set;
    return this.models.Playlist.findByIdAndUpdate(
      oid(id),
      { $set: { ...rest, ...(recitationIds ? { recitationIds: recitationIds.map(oid) } : {}) } },
      { returnDocument: 'after' },
    ).lean<PlaylistDoc>();
  }

  async delete(id: string): Promise<void> {
    await this.models.Playlist.deleteOne({ _id: oid(id) });
  }

  async deleteByOwner(ownerId: string): Promise<void> {
    await this.models.Playlist.deleteMany({ ownerId: oid(ownerId) });
  }
}

export class ReportRepository {
  constructor(private readonly models: Models) {}

  findById(id: string): Promise<ReportDoc | null> {
    return this.models.Report.findById(oid(id)).lean<ReportDoc>();
  }

  async insert(doc: {
    recitationId: string;
    reporterId: string;
    reason: ReportDoc['reason'];
    note: string | null;
  }) {
    const created = await this.models.Report.create({
      ...doc,
      recitationId: oid(doc.recitationId),
      reporterId: oid(doc.reporterId),
    });
    return created.toObject<ReportDoc>();
  }

  listOpen(cursor: CursorState | null, limit: number): Promise<ReportDoc[]> {
    return this.models.Report.find({ status: 'open', ...afterCursor('createdAt', 1, cursor) })
      .sort({ createdAt: 1, _id: 1 })
      .limit(limit + 1)
      .lean<ReportDoc[]>();
  }

  countOpen(): Promise<number> {
    return this.models.Report.countDocuments({ status: 'open' });
  }

  async openCounts(recitationIds: string[]): Promise<Map<string, number>> {
    const rows = await this.models.Report.aggregate<{ _id: { toHexString(): string }; n: number }>([
      { $match: { status: 'open', recitationId: { $in: recitationIds.map(oid) } } },
      { $group: { _id: '$recitationId', n: { $sum: 1 } } },
    ]);
    return new Map(rows.map((r) => [r._id.toHexString(), r.n]));
  }

  /** Closes a report if it is still open. */
  resolve(
    id: string,
    status: Exclude<ReportStatus, 'open'>,
    note: string | null,
    by: string,
    at: Date,
  ) {
    return this.models.Report.findOneAndUpdate(
      { _id: oid(id), status: 'open' },
      { $set: { status, resolution: { note, decidedAt: at, decidedBy: oid(by) } } },
      { returnDocument: 'after' },
    ).lean<ReportDoc>();
  }

  async resolveAllForRecitation(
    recitationId: string,
    note: string,
    by: string,
    at: Date,
  ): Promise<void> {
    await this.models.Report.updateMany(
      { recitationId: oid(recitationId), status: 'open' },
      { $set: { status: 'actioned', resolution: { note, decidedAt: at, decidedBy: oid(by) } } },
    );
  }
}
