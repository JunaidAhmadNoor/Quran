import { z } from 'zod';
import {
  CountryCode,
  IsoDateTime,
  NON_EMPTY_PATCH_MESSAGE,
  ObjectId,
  PageQuery,
  nonEmptyPatch,
  paginated,
} from '../common';
import { AccountMode, RecitationStatus, Role } from '../enums';
import { MAX_BIO_LENGTH, MAX_NAME_LENGTH } from '../limits';
import { Playlist } from './playlists';
import { RecitationDetail, RecitationPage } from './recitations';

/** The private view of an account. Returned only to the account itself and to admins. */
export const UserAccount = z
  .object({
    id: ObjectId,
    name: z.string(),
    email: z.email(),
    emailVerified: z.boolean(),
    image: z.url().nullable(),
    role: Role,
    mode: AccountMode,
    reciterSince: IsoDateTime.nullable().meta({
      description:
        'When the user first switched to reciter mode, which turned on their public reciter profile. null if never.',
    }),
    verifiedReciter: z.boolean().meta({
      description: 'Badge granted by moderators/admins. Verified uploads skip the review queue.',
    }),
    bio: z.string().nullable(),
    country: CountryCode.nullable(),
    createdAt: IsoDateTime,
  })
  .meta({ id: 'UserAccount' });

export const UpdateMeBody = z
  .object({
    name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
    bio: z.string().trim().max(MAX_BIO_LENGTH).nullable(),
    country: CountryCode.nullable(),
  })
  .partial()
  .refine(nonEmptyPatch, NON_EMPTY_PATCH_MESSAGE)
  .meta({
    id: 'UpdateMeBody',
    description: 'Email, password and image changes go through Better Auth (/api/auth/*).',
  });

export const LibraryQuery = PageQuery;

export const LibraryResponse = z
  .object({
    likes: RecitationPage.meta({ description: 'Liked recitations, most recently liked first.' }),
    playlists: z.array(Playlist).meta({ description: 'All of the caller’s playlists (max 100).' }),
  })
  .meta({ id: 'LibraryResponse' });

export const MyRecitationsQuery = PageQuery.extend({ status: RecitationStatus.optional() });

export const MyRecitationPage = paginated(RecitationDetail).meta({
  id: 'MyRecitationPage',
  description: 'The caller’s own uploads in every status, newest first.',
});

export const SwitchModeBody = z.object({ mode: AccountMode }).meta({
  id: 'SwitchModeBody',
  description:
    'Switching to reciter the first time sets reciterSince and makes the reciter profile public. Switching back to listener keeps the profile and its recitations public. No new sign-in is needed.',
});

export const ReciterStats = z
  .object({
    recitations: z.object({
      pending: z.int().min(0),
      approved: z.int().min(0),
      rejected: z.int().min(0),
    }),
    totalPlays: z.int().min(0),
    totalLikes: z.int().min(0),
    playsLast7Days: z.int().min(0),
    storage: z.object({
      usedBytes: z.int().min(0),
      quotaBytes: z.int().positive(),
    }),
  })
  .meta({ id: 'ReciterStats', description: 'Dashboard numbers for reciter mode.' });
