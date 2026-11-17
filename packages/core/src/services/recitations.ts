import { PLAY_DEDUPE_WINDOW_SEC, type RecitationStatus } from '@tilawah/contracts';
import type { RecitationDoc } from '@tilawah/db';
import { isValidAyahRange } from '@tilawah/quran-data';
import { autoApproves, isStaff, requireActor, type Actor } from '../actor';
import { DAY_MS, utcDay } from '../clock';
import type { C, Out, ServiceDeps } from '../context';
import { decodeCursor, filtersHash, page } from '../cursor';
import { DomainError, conflict, forbidden, notFound } from '../errors';
import type { Presenter } from '../presenter';
import { cursorOf } from '../repositories/keyset';
import type { PublicFilters } from '../repositories/recitations';

type ListQuery = Out<typeof C.ListRecitationsQuery>;
type Page = Out<typeof C.RecitationPage>;

/** Approved: everyone. Private: only the uploader (not staff). Other statuses: uploader and staff. */
export const canSee = (doc: RecitationDoc, actor: Actor | null): boolean => {
  if (doc.status === 'approved') return true;
  if (actor === null) return false;
  if (actor.userId === doc.uploaderId.toHexString()) return true;
  return doc.status !== 'private' && isStaff(actor);
};

const CONTENT_FIELDS = ['surah', 'ayahFrom', 'ayahTo', 'riwayah'] as const;

export class RecitationService {
  constructor(
    private readonly deps: ServiceDeps,
    private readonly presenter: Presenter,
  ) {}

  /** Approved recitations only; pending ones never appear in public lists. */
  async list(actor: Actor | null, query: ListQuery): Promise<Page> {
    const filters: PublicFilters = {
      surah: query.surah,
      reciterId: query.reciterId,
      style: query.style,
      riwayah: query.riwayah,
    };
    const hash = filtersHash({ ...filters, sort: query.sort });
    const cursor = decodeCursor(query.cursor, hash);
    const repo = this.deps.repos.recitations;

    if (query.sort === 'trending') {
      const offset = cursor?.o ?? 0;
      const since = utcDay(new Date(this.deps.clock.now().getTime() - 6 * DAY_MS));
      const rows = await repo.listTrending(filters, since, offset, query.limit);
      const result = page(rows, query.limit, () => ({ f: hash, o: offset + query.limit }));
      return {
        items: await this.presenter.recitations(result.rows, actor),
        nextCursor: result.nextCursor,
      };
    }

    const field = query.sort === 'popular' ? 'playCount' : 'createdAt';
    const rows = await repo.listApproved(filters, query.sort, cursor, query.limit);
    const result = page(rows, query.limit, (last) => cursorOf(field, hash, last));
    return {
      items: await this.presenter.recitations(result.rows, actor),
      nextCursor: result.nextCursor,
    };
  }

  async get(actor: Actor | null, id: string): Promise<Out<typeof C.RecitationDetail>> {
    const doc = await this.visible(actor, id);
    const [detail] = await this.presenter.details([doc], actor);
    if (!detail) throw notFound('Recitation');
    return detail;
  }

  async listMine(actor: Actor | null, query: Out<typeof C.MyRecitationsQuery>) {
    const me = requireActor(actor);
    const hash = filtersHash({ mine: me.userId, status: query.status });
    const rows = await this.deps.repos.recitations.listByUploader(
      me.userId,
      query.status,
      decodeCursor(query.cursor, hash),
      query.limit,
    );
    const result = page(rows, query.limit, (last) => cursorOf('createdAt', hash, last));
    return { items: await this.presenter.details(result.rows, me), nextCursor: result.nextCursor };
  }

  async update(actor: Actor | null, id: string, body: Out<typeof C.UpdateRecitationBody>) {
    const me = requireActor(actor);
    const doc = await this.visible(me, id);
    const isOwner = doc.uploaderId.toHexString() === me.userId;
    if (!isOwner && !isStaff(me)) throw forbidden('You can only edit your own recitations');
    if (doc.status === 'removed') throw conflict('A removed recitation cannot be edited');

    const next = { surah: doc.surah, ayahFrom: doc.ayahFrom, ayahTo: doc.ayahTo, ...body };
    if (!isValidAyahRange(next.surah, next.ayahFrom, next.ayahTo)) {
      throw new DomainError(
        'INVALID_AYAH_RANGE',
        `Surah ${next.surah} has no ayahs ${next.ayahFrom}–${next.ayahTo}`,
      );
    }

    const { visibility, ...fields } = body;
    let status: RecitationStatus | undefined;
    if (visibility !== undefined) {
      if (!isOwner) throw forbidden('Only the uploader can change who sees a recitation');
      if (doc.status === 'rejected')
        throw conflict('A rejected recitation cannot change visibility');
      if (visibility === 'private') status = 'private';
      else if (doc.status === 'private') status = autoApproves(me) ? 'approved' : 'pending';
    }
    const contentChanged = CONTENT_FIELDS.some(
      (f) => fields[f] !== undefined && fields[f] !== doc[f],
    );
    const backToReview =
      isOwner && !autoApproves(me) && (status ?? doc.status) === 'approved' && contentChanged;
    if (backToReview) status = 'pending';
    const updated = await this.deps.repos.recitations.update(id, {
      ...fields,
      ...(status ? { status } : {}),
    });
    if (!updated) throw notFound('Recitation');
    const [detail] = await this.presenter.details([updated], me);
    if (!detail) throw notFound('Recitation');
    return detail;
  }

  /** Owner or moderator. Marks removed and deletes the audio; idempotent. */
  async remove(actor: Actor | null, id: string): Promise<void> {
    const me = requireActor(actor);
    const doc = await this.visible(me, id);
    if (doc.uploaderId.toHexString() !== me.userId && !isStaff(me)) {
      throw forbidden('You can only remove your own recitations');
    }
    if (doc.status !== 'removed') {
      await this.deps.repos.recitations.update(id, { status: 'removed' });
    }
    await this.purgeAudio(doc);
  }

  async recordPlay(listener: string, id: string): Promise<Out<typeof C.PlayResponse>> {
    const doc = await this.visible(null, id);
    const now = this.deps.clock.now();
    const { plays, recitations } = this.deps.repos;
    const counted = await plays.claimPlay(id, listener, now, PLAY_DEDUPE_WINDOW_SEC * 1000);
    if (!counted) return { counted: false, playCount: doc.playCount };
    const [playCount] = await Promise.all([
      recitations.incPlayCount(id),
      plays.recordDaily(id, now),
    ]);
    return { counted: true, playCount };
  }

  async like(actor: Actor | null, id: string): Promise<Out<typeof C.LikeResponse>> {
    const me = requireActor(actor);
    await this.approved(id);
    return { liked: true, likeCount: await this.deps.repos.likes.like(me.userId, id) };
  }

  async unlike(actor: Actor | null, id: string): Promise<Out<typeof C.LikeResponse>> {
    const me = requireActor(actor);
    await this.approved(id);
    return { liked: false, likeCount: await this.deps.repos.likes.unlike(me.userId, id) };
  }

  async report(actor: Actor | null, id: string, body: Out<typeof C.CreateReportBody>) {
    const me = requireActor(actor);
    await this.visible(me, id);
    try {
      const report = await this.deps.repos.reports.insert({
        recitationId: id,
        reporterId: me.userId,
        reason: body.reason,
        note: body.note ?? null,
      });
      return {
        id: report._id.toHexString(),
        status: report.status,
        createdAt: report.createdAt.toISOString(),
      };
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new DomainError('ALREADY_REPORTED', 'You already reported this recitation');
      }
      throw error;
    }
  }

  /** Deletes the R2 object once; a failure is retried by the maintenance job. */
  async purgeAudio(doc: RecitationDoc): Promise<void> {
    if (doc.audioDeletedAt) return;
    try {
      await this.deps.storage.delete(doc.audioKey);
      await this.deps.repos.recitations.update(doc._id.toHexString(), {
        audioDeletedAt: this.deps.clock.now(),
      });
    } catch (error) {
      console.error('Audio deletion failed; the maintenance job will retry', {
        recitationId: doc._id.toHexString(),
        error,
      });
    }
  }

  private async visible(actor: Actor | null, id: string): Promise<RecitationDoc> {
    const doc = await this.deps.repos.recitations.findById(id);
    if (!doc || !canSee(doc, actor)) throw notFound('Recitation');
    return doc;
  }

  private async approved(id: string): Promise<RecitationDoc> {
    const doc = await this.deps.repos.recitations.findById(id);
    if (doc?.status !== 'approved') throw notFound('Recitation');
    return doc;
  }
}
