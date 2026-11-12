import type { RecitationStatus } from '@tilawah/contracts';
import type { ReportDoc } from '@tilawah/db';
import { requireAdmin, requireStaff, type Actor } from '../actor';
import type { C, Out, ServiceDeps } from '../context';
import { decodeCursor, filtersHash, page } from '../cursor';
import { conflict, notFound } from '../errors';
import type { Presenter } from '../presenter';
import { cursorOf, oid } from '../repositories/keyset';
import type { RecitationService } from './recitations';

const ALLOWED_FROM: Record<'approve' | 'reject' | 'remove', RecitationStatus[]> = {
  approve: ['pending', 'rejected'],
  reject: ['pending'],
  remove: ['pending', 'approved'],
};

const NEXT_STATUS = { approve: 'approved', reject: 'rejected', remove: 'removed' } as const;

export class ModerationService {
  constructor(
    private readonly deps: ServiceDeps,
    private readonly presenter: Presenter,
    private readonly recitations: RecitationService,
  ) {}

  async queue(actor: Actor | null, query: Out<typeof C.ModerationQueueQuery>) {
    const me = requireStaff(actor);
    const { recitations, reports } = this.deps.repos;
    const hash = filtersHash({ queue: query.kind });
    const cursor = decodeCursor(query.cursor, hash);
    const [pendingRecitations, openReports] = await Promise.all([
      recitations.countPending(),
      reports.countOpen(),
    ]);
    const counts = { pendingRecitations, openReports };

    if (query.kind === 'reports') {
      const rows = await reports.listOpen(cursor, query.limit);
      const result = page(rows, query.limit, (last) => cursorOf('createdAt', hash, last));
      return {
        kind: 'reports' as const,
        items: await this.presentReports(result.rows, me),
        nextCursor: result.nextCursor,
        counts,
      };
    }

    const rows = await recitations.listPending(cursor, query.limit);
    const result = page(rows, query.limit, (last) => cursorOf('createdAt', hash, last));
    const details = await this.presenter.details(result.rows, me);
    const reportCounts = await reports.openCounts(details.map((d) => d.id));
    return {
      kind: 'recitations' as const,
      items: details.map((d) => ({ ...d, openReportCount: reportCounts.get(d.id) ?? 0 })),
      nextCursor: result.nextCursor,
      counts,
    };
  }

  async decideRecitation(
    actor: Actor | null,
    id: string,
    body: Out<typeof C.RecitationDecisionBody>,
  ) {
    const me = requireStaff(actor);
    const { recitations, reports } = this.deps.repos;
    const now = this.deps.clock.now();
    const updated = await recitations.transition(id, ALLOWED_FROM[body.decision], {
      status: NEXT_STATUS[body.decision],
      moderationNote: body.decision === 'approve' ? null : body.reason,
      moderatedBy: oid(me.userId),
      moderatedAt: now,
    });
    if (!updated) {
      const existing = await recitations.findById(id);
      if (!existing) throw notFound('Recitation');
      throw conflict(`Cannot ${body.decision} a recitation that is ${existing.status}`, {
        status: existing.status,
      });
    }
    if (body.decision === 'remove') {
      if (body.resolveReports)
        await reports.resolveAllForRecitation(id, body.reason, me.userId, now);
      await this.recitations.purgeAudio(updated);
    }
    const [detail] = await this.presenter.details([updated], me);
    if (!detail) throw notFound('Recitation');
    return detail;
  }

  async decideReport(actor: Actor | null, id: string, body: Out<typeof C.ReportDecisionBody>) {
    const me = requireStaff(actor);
    const { reports } = this.deps.repos;
    const resolved = await reports.resolve(
      id,
      body.decision,
      body.note ?? null,
      me.userId,
      this.deps.clock.now(),
    );
    if (!resolved) {
      if (!(await reports.findById(id))) throw notFound('Report');
      throw conflict('This report is already closed');
    }
    const [presented] = await this.presentReports([resolved], me);
    if (!presented) throw notFound('Report');
    return presented;
  }

  private async presentReports(docs: ReportDoc[], me: Actor): Promise<Out<typeof C.Report>[]> {
    const { recitations, users } = this.deps.repos;
    const recDocs = await recitations.findByIds(docs.map((d) => d.recitationId.toHexString()));
    const presented = new Map(
      (await this.presenter.recitations(recDocs, me)).map((r) => [r.id, r]),
    );
    const people = await users.findByIds([
      ...new Set(
        docs.flatMap((d) => [
          d.reporterId.toHexString(),
          ...(d.resolution ? [d.resolution.decidedBy.toHexString()] : []),
        ]),
      ),
    ]);
    const name = (id: string) =>
      people.find((u) => u._id.toHexString() === id)?.name ?? 'Deleted account';

    return docs.flatMap((d) => {
      const recitation = presented.get(d.recitationId.toHexString());
      if (!recitation) return [];
      const reporterId = d.reporterId.toHexString();
      return [
        {
          id: d._id.toHexString(),
          reason: d.reason,
          note: d.note,
          status: d.status,
          createdAt: d.createdAt.toISOString(),
          reporter: { id: reporterId, name: name(reporterId) },
          recitation,
          resolution: d.resolution
            ? {
                note: d.resolution.note,
                decidedAt: d.resolution.decidedAt.toISOString(),
                decidedBy: {
                  id: d.resolution.decidedBy.toHexString(),
                  name: name(d.resolution.decidedBy.toHexString()),
                },
              }
            : null,
        },
      ];
    });
  }
}

export class AdminService {
  constructor(
    private readonly deps: ServiceDeps,
    private readonly presenter: Presenter,
  ) {}

  async findUsers(actor: Actor | null, query: Out<typeof C.FindUsersQuery>) {
    requireAdmin(actor);
    const user = await this.deps.repos.users.findByEmail(query.email);
    return { items: user ? [this.presenter.userAccount(user)] : [] };
  }

  async updateUser(actor: Actor | null, id: string, body: Out<typeof C.UpdateUserBody>) {
    const me = requireAdmin(actor);
    const { users } = this.deps.repos;
    const target = await users.findById(id);
    if (!target) throw notFound('User');
    if (body.role !== undefined && id === me.userId)
      throw conflict('Admins cannot change their own role');
    const grantsBadge = body.verifiedReciter === true && !target.reciterSince;
    const updated = await users.update(id, {
      ...body,
      ...(grantsBadge ? { reciterSince: this.deps.clock.now() } : {}),
    });
    if (!updated) throw notFound('User');
    return this.presenter.userAccount(updated);
  }
}
