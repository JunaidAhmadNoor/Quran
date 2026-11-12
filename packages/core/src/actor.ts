import type { AccountMode, Role } from '@tilawah/contracts';
import { DomainError, forbidden } from './errors';

/** Who is making the request. Built fresh from the database on every request. */
export interface Actor {
  userId: string;
  role: Role;
  mode: AccountMode;
  reciterSince: Date | null;
  verifiedReciter: boolean;
  sessionCreatedAt: Date;
}

export const isStaff = (actor: Actor | null): actor is Actor =>
  actor?.role === 'moderator' || actor?.role === 'admin';

export const isAdmin = (actor: Actor | null): actor is Actor => actor?.role === 'admin';

/** Verified reciters and staff skip the review queue. Switching to reciter mode does not. */
export const autoApproves = (actor: Actor): boolean => actor.verifiedReciter || isStaff(actor);

export function requireActor(actor: Actor | null): Actor {
  if (!actor) throw new DomainError('UNAUTHENTICATED', 'Sign in to do this');
  return actor;
}

/** Defense in depth: route() checks roles too, but services never trust the caller. */
export function requireStaff(actor: Actor | null): Actor {
  const a = requireActor(actor);
  if (!isStaff(a)) throw forbidden('Only moderators can do this');
  return a;
}

export function requireAdmin(actor: Actor | null): Actor {
  const a = requireActor(actor);
  if (!isAdmin(a)) throw forbidden('Only admins can do this');
  return a;
}

export function requireReciterProfile(actor: Actor): void {
  if (!actor.reciterSince) {
    throw new DomainError(
      'RECITER_PROFILE_REQUIRED',
      'Switch to reciter mode once to turn on your reciter profile before uploading',
    );
  }
}
