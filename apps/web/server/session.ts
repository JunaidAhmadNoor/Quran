// For Server Components: the same container, services and Actor the API uses (layering rule 5).
import 'server-only';
import type { Actor } from '@tilawah/core';
import { headers } from 'next/headers';
import { cache } from 'react';
import { resolveActor } from './actor';
import { getContainer } from './container';

/** Per-request: container + signed-in actor (null when signed out). */
export const getServerContext = cache(async () => {
  const c = await getContainer();
  const actor: Actor | null = await resolveActor(c, await headers());
  return { core: c.core, actor, config: c.config, googleEnabled: c.googleEnabled };
});

/** The signed-in account for the header, or null. Never throws (e.g. during a build). */
export const getMeOrNull = cache(async () => {
  try {
    const { core, actor } = await getServerContext();
    return actor ? await core.account.me(actor) : null;
  } catch {
    return null;
  }
});

/** Unknown ids and invalid params render the designed 404 instead of an error page. */
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  const { DomainError } = await import('@tilawah/core');
  const { notFound } = await import('next/navigation');
  try {
    return await promise;
  } catch (error) {
    if (
      error instanceof DomainError &&
      (error.code === 'NOT_FOUND' || error.code === 'VALIDATION_ERROR')
    )
      notFound();
    throw error;
  }
}

/**
 * Moderators and admins work in the moderation area: listener pages (home, library, studio,
 * upload, memorize) send them there. Public surah and recitation pages stay reachable from it.
 */
export async function sendStaffToWork(): Promise<void> {
  const { actor } = await getServerContext();
  if (actor && (actor.role === 'moderator' || actor.role === 'admin')) {
    const { redirect } = await import('next/navigation');
    redirect('/moderation');
  }
}
