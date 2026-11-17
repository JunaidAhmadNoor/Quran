import { z } from 'zod';
import { NON_EMPTY_PATCH_MESSAGE, PageQuery, nonEmptyPatch, paginated } from '../common';
import { Role } from '../enums';
import { UserAccount } from './me';

export const ListUsersQuery = PageQuery.extend({
  q: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .meta({ description: 'Case-insensitive text found in the name or email.' }),
  role: Role.optional(),
});

const count = z.int().min(0);

export const AdminUser = UserAccount.extend({
  recitations: z.object({
    approved: count,
    pending: count,
    rejected: count,
    removed: count,
    private: count,
  }),
}).meta({
  id: 'AdminUser',
  description: 'An account as admins see it, with its recitation counts.',
});

export const AdminUserPage = paginated(AdminUser).meta({
  id: 'AdminUserPage',
  description: 'Newest accounts first.',
});

export const AdminStats = z
  .object({
    users: z.object({
      total: count,
      reciters: count,
      verifiedReciters: count,
      moderators: count,
      admins: count,
      emailNotVerified: count,
      newLast7Days: count,
    }),
    recitations: z.object({
      pending: count,
      approved: count,
      rejected: count,
      removed: count,
      private: count,
    }),
    openReports: count,
    playsLast7Days: count,
    storageBytes: count.meta({ description: 'Audio stored for recitations that are not removed.' }),
  })
  .meta({ id: 'AdminStats' });

export const UpdateUserBody = z
  .object({ role: Role, verifiedReciter: z.boolean() })
  .partial()
  .refine(nonEmptyPatch, NON_EMPTY_PATCH_MESSAGE)
  .meta({
    id: 'UpdateUserBody',
    description:
      'role changes staff permissions. Setting verifiedReciter to true also turns on the reciter profile if it is off. An admin cannot change their own role.',
  });
