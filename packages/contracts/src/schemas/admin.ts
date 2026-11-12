import { z } from 'zod';
import { NON_EMPTY_PATCH_MESSAGE, nonEmptyPatch } from '../common';
import { Role } from '../enums';
import { UserAccount } from './me';

export const FindUsersQuery = z.object({
  email: z.email().meta({ description: 'Exact, case-insensitive match.' }),
});

export const FindUsersResponse = z
  .object({ items: z.array(UserAccount).max(1) })
  .meta({ id: 'FindUsersResponse' });

export const UpdateUserBody = z
  .object({ role: Role, verifiedReciter: z.boolean() })
  .partial()
  .refine(nonEmptyPatch, NON_EMPTY_PATCH_MESSAGE)
  .meta({
    id: 'UpdateUserBody',
    description:
      'role changes staff permissions. Setting verifiedReciter to true also turns on the reciter profile if it is off. An admin cannot change their own role.',
  });
