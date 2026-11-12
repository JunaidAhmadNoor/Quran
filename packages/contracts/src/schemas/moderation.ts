import { z } from 'zod';
import { Cursor, IsoDateTime, ObjectId, PageQuery } from '../common';
import { ReportReason, ReportStatus } from '../enums';
import { MAX_MODERATION_REASON_LENGTH } from '../limits';
import { Recitation, RecitationDetail } from './recitations';

const UserRef = z.object({ id: ObjectId, name: z.string() });

export const Report = z
  .object({
    id: ObjectId,
    reason: ReportReason,
    note: z.string().nullable(),
    status: ReportStatus,
    createdAt: IsoDateTime,
    reporter: UserRef,
    recitation: Recitation,
    resolution: z
      .object({
        note: z.string().nullable(),
        decidedAt: IsoDateTime,
        decidedBy: UserRef,
      })
      .nullable(),
  })
  .meta({ id: 'Report' });

export const ModerationQueueQuery = PageQuery.extend({
  kind: z.enum(['recitations', 'reports']).default('recitations'),
});

const QueueCounts = z
  .object({ pendingRecitations: z.int().min(0), openReports: z.int().min(0) })
  .meta({ id: 'ModerationQueueCounts' });

export const QueuedRecitation = RecitationDetail.extend({
  openReportCount: z.int().min(0),
}).meta({ id: 'QueuedRecitation' });

export const ModerationQueueResponse = z
  .discriminatedUnion('kind', [
    z.object({
      kind: z.literal('recitations'),
      items: z.array(QueuedRecitation).meta({ description: 'Pending uploads, oldest first.' }),
      nextCursor: Cursor.nullable(),
      counts: QueueCounts,
    }),
    z.object({
      kind: z.literal('reports'),
      items: z.array(Report).meta({ description: 'Open reports, oldest first.' }),
      nextCursor: Cursor.nullable(),
      counts: QueueCounts,
    }),
  ])
  .meta({ id: 'ModerationQueueResponse' });

const Reason = z.string().trim().min(3).max(MAX_MODERATION_REASON_LENGTH);

export const RecitationDecisionBody = z
  .discriminatedUnion('decision', [
    z.object({ decision: z.literal('approve') }),
    z.object({ decision: z.literal('reject'), reason: Reason }),
    z.object({
      decision: z.literal('remove'),
      reason: Reason,
      resolveReports: z
        .boolean()
        .default(true)
        .meta({ description: 'Mark open reports on this recitation as actioned.' }),
    }),
  ])
  .meta({
    id: 'RecitationDecisionBody',
    description:
      'approve: pending|rejected → approved. reject: pending → rejected. remove: pending|approved → removed. Other transitions return CONFLICT.',
  });

export const ReportDecisionBody = z
  .object({
    decision: z.enum(['actioned', 'dismissed']),
    note: z.string().trim().max(MAX_MODERATION_REASON_LENGTH).optional(),
  })
  .meta({ id: 'ReportDecisionBody' });
