'use client';
import type { UserAccount } from '@tilawah/contracts';
import { useQuery } from '@tanstack/react-query';
import type { z } from 'zod';
import { ApiError, api } from '@/lib/api';

export type Me = z.output<typeof UserAccount>;

/** The signed-in account, or null. Seeded from the server render, so no flash on load. */
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async (): Promise<Me | null> => {
      try {
        return await api.getMe();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 60_000,
  });
}

export const isStaffRole = (me: Me | null | undefined) =>
  me?.role === 'moderator' || me?.role === 'admin';
