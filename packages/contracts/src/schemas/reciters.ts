import { z } from 'zod';
import { IsoDateTime, PageQuery, paginated } from '../common';
import { RecitationSort } from '../enums';
import { RecitationPage, ReciterSummary } from './recitations';

export const ReciterProfile = ReciterSummary.extend({
  bio: z.string().nullable(),
  reciterSince: IsoDateTime,
  stats: z.object({
    approvedRecitations: z.int().min(0),
    totalPlays: z.int().min(0),
  }),
}).meta({
  id: 'ReciterProfile',
  description:
    'Visible once the user has turned on reciter mode (reciterSince is set); otherwise 404, so listener-only accounts are never exposed.',
});

export const ListRecitersQuery = PageQuery;

export const ReciterPage = paginated(ReciterSummary).meta({
  id: 'ReciterPage',
  description: 'Verified reciters only.',
});

export const GetReciterQuery = PageQuery.extend({ sort: RecitationSort.default('newest') });

export const GetReciterResponse = z
  .object({ reciter: ReciterProfile, recitations: RecitationPage })
  .meta({ id: 'GetReciterResponse' });
