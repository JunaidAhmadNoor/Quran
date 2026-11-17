import { z } from 'zod';

/** Staff permissions only. Listening vs reciting is a mode every account can switch (AccountMode). */
export const Role = z
  .enum(['user', 'moderator', 'admin'])
  .meta({ id: 'Role', description: 'user is the default for new accounts.' });
export type Role = z.infer<typeof Role>;

/**
 * Fiverr-style mode switch: the same account moves between listening and reciting at any time,
 * without signing out. It changes which screens the apps show, not what the account may do.
 */
export const AccountMode = z.enum(['listener', 'reciter']).meta({
  id: 'AccountMode',
  description: 'Which side of the app the user is in. Saved on the account, so web and app agree.',
});
export type AccountMode = z.infer<typeof AccountMode>;

export const RecitationStatus = z
  .enum(['private', 'pending', 'approved', 'rejected', 'removed'])
  .meta({
    id: 'RecitationStatus',
    description:
      'private = visible only to the uploader and never reviewed; pending = waiting for a moderator.',
  });
export type RecitationStatus = z.infer<typeof RecitationStatus>;

/** Chosen by the uploader. Public recitations are reviewed before they are published. */
export const RecitationVisibility = z.enum(['public', 'private']).meta({
  id: 'RecitationVisibility',
  description:
    'public = sent to moderators (or published at once for verified reciters); private = only the uploader can see and play it.',
});
export type RecitationVisibility = z.infer<typeof RecitationVisibility>;

export const RecitationStyle = z
  .enum(['murattal', 'mujawwad', 'teaching'])
  .meta({ id: 'RecitationStyle' });
export type RecitationStyle = z.infer<typeof RecitationStyle>;

/**
 * The 20 canonical transmissions (two per each of the ten qira'at).
 * Only Hafs matches the Tanzil text the site displays; see docs/DATA_MODEL.md.
 */
export const Riwayah = z
  .enum([
    'hafs',
    'shubah',
    'warsh',
    'qalun',
    'al_bazzi',
    'qunbul',
    'al_duri_abu_amr',
    'al_susi',
    'hisham',
    'ibn_dhakwan',
    'khalaf_an_hamzah',
    'khallad',
    'abu_al_harith',
    'al_duri_al_kisai',
    'ibn_wardan',
    'ibn_jammaz',
    'ruways',
    'rawh',
    'ishaq',
    'idris',
  ])
  .meta({ id: 'Riwayah', description: 'Transmission (riwayah). Default hafs.' });
export type Riwayah = z.infer<typeof Riwayah>;

export const RecitationSort = z.enum(['newest', 'popular', 'trending']).meta({
  id: 'RecitationSort',
  description: 'popular = all-time plays; trending = plays in the last 7 days.',
});
export type RecitationSort = z.infer<typeof RecitationSort>;

export const ReportReason = z
  .enum(['wrong_surah', 'recitation_mistake', 'not_quran', 'copyright', 'other'])
  .meta({ id: 'ReportReason' });
export type ReportReason = z.infer<typeof ReportReason>;

export const ReportStatus = z.enum(['open', 'actioned', 'dismissed']).meta({ id: 'ReportStatus' });
export type ReportStatus = z.infer<typeof ReportStatus>;

export const RevelationPlace = z.enum(['meccan', 'medinan']).meta({ id: 'RevelationPlace' });
export type RevelationPlace = z.infer<typeof RevelationPlace>;

export const AudioContentType = z
  .enum(['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/webm'])
  .meta({ id: 'AudioContentType' });
export type AudioContentType = z.infer<typeof AudioContentType>;
