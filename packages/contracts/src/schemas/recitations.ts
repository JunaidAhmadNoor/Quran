import { z } from 'zod';
import {
  AYAH_RANGE_MESSAGE,
  AyahNumber,
  IsoDateTime,
  NON_EMPTY_PATCH_MESSAGE,
  ObjectId,
  PageQuery,
  SurahNumber,
  SurahNumberParam,
  ayahRangeIsOrdered,
  nonEmptyPatch,
  paginated,
  CountryCode,
} from '../common';
import {
  AudioContentType,
  RecitationSort,
  RecitationStatus,
  RecitationVisibility,
  RecitationStyle,
  ReportReason,
  ReportStatus,
  Riwayah,
} from '../enums';
import { MAX_DURATION_SEC, MAX_REPORT_NOTE_LENGTH, MAX_TITLE_LENGTH } from '../limits';

const Title = z.string().trim().min(1).max(MAX_TITLE_LENGTH);

export const ReciterSummary = z
  .object({
    id: ObjectId,
    name: z.string(),
    image: z.url().nullable(),
    country: CountryCode.nullable(),
    verifiedReciter: z.boolean(),
  })
  .meta({
    id: 'ReciterSummary',
    description: 'Public view of the user who uploaded a recitation.',
  });

export const StreamInfo = z
  .object({
    url: z.url(),
    expiresAt: IsoDateTime.nullable().meta({
      description:
        'When the signed URL stops working. null for permanent public URLs. Refetch the recitation to get a fresh URL.',
    }),
    contentType: AudioContentType,
  })
  .meta({ id: 'StreamInfo' });

export const ViewerState = z
  .object({ liked: z.boolean(), isOwner: z.boolean() })
  .meta({ id: 'ViewerState', description: 'Present only when the request is authenticated.' });

export const Recitation = z
  .object({
    id: ObjectId,
    surah: SurahNumber,
    ayahFrom: AyahNumber,
    ayahTo: AyahNumber,
    title: z.string(),
    riwayah: Riwayah,
    style: RecitationStyle,
    durationSec: z.number().positive(),
    status: RecitationStatus,
    playCount: z.int().min(0),
    likeCount: z.int().min(0),
    createdAt: IsoDateTime,
    reciter: ReciterSummary,
    stream: StreamInfo,
    viewer: ViewerState.nullable(),
  })
  .meta({ id: 'Recitation' });
export type Recitation = z.infer<typeof Recitation>;

/** Adds fields only the owner and moderators see. For everyone else they are null. */
export const RecitationDetail = Recitation.extend({
  sizeBytes: z.int().positive().nullable(),
  moderationNote: z.string().nullable().meta({ description: 'Reason given on reject or remove.' }),
}).meta({ id: 'RecitationDetail' });
export type RecitationDetail = z.infer<typeof RecitationDetail>;

export const ListRecitationsQuery = PageQuery.extend({
  surah: SurahNumberParam.optional(),
  reciterId: ObjectId.optional(),
  style: RecitationStyle.optional(),
  riwayah: Riwayah.optional(),
  sort: RecitationSort.default('newest'),
});

export const RecitationPage = paginated(Recitation).meta({ id: 'RecitationPage' });

export const CreateRecitationBody = z
  .object({
    uploadToken: z
      .string()
      .min(1)
      .max(4096)
      .meta({ description: 'The uploadToken returned by POST /uploads/presign.' }),
    title: Title,
    riwayah: Riwayah.default('hafs'),
    style: RecitationStyle,
    durationSec: z
      .number()
      .positive()
      .max(MAX_DURATION_SEC)
      .meta({ description: 'Read by the client from the audio metadata.' }),
    visibility: RecitationVisibility.default('public'),
  })
  .meta({ id: 'CreateRecitationBody' });

export const UpdateRecitationBody = z
  .object({
    title: Title,
    style: RecitationStyle,
    riwayah: Riwayah,
    surah: SurahNumber,
    ayahFrom: AyahNumber,
    ayahTo: AyahNumber,
    visibility: RecitationVisibility,
  })
  .partial()
  .refine(nonEmptyPatch, NON_EMPTY_PATCH_MESSAGE)
  .refine(ayahRangeIsOrdered, { message: AYAH_RANGE_MESSAGE, path: ['ayahTo'] })
  .meta({
    id: 'UpdateRecitationBody',
    description:
      'Owners may change any field. If a non-verified owner changes surah, ayah range or riwayah of an approved recitation, it returns to pending. visibility (owner only): private hides it from everyone else; public sends a private recitation to review (published at once for verified reciters). Rejected and removed recitations cannot change visibility.',
  });

export const PlayResponse = z
  .object({
    counted: z
      .boolean()
      .meta({ description: 'false when this listener already counted a play recently.' }),
    playCount: z.int().min(0),
  })
  .meta({ id: 'PlayResponse' });

export const LikeResponse = z
  .object({ liked: z.boolean(), likeCount: z.int().min(0) })
  .meta({ id: 'LikeResponse', description: 'Like and unlike are idempotent.' });

export const CreateReportBody = z
  .object({
    reason: ReportReason,
    note: z.string().trim().max(MAX_REPORT_NOTE_LENGTH).optional(),
  })
  .refine((v) => v.reason !== 'other' || (v.note !== undefined && v.note.length > 0), {
    message: 'A note is required when the reason is "other"',
    path: ['note'],
  })
  .meta({ id: 'CreateReportBody' });

export const ReportReceipt = z
  .object({ id: ObjectId, status: ReportStatus, createdAt: IsoDateTime })
  .meta({ id: 'ReportReceipt' });
