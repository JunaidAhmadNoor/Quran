import type { Actor } from '@tilawah/core';
import type { AppContainer } from './container';

/** Session → Actor, reading the user fresh so mode and role changes apply immediately. */
export async function resolveActor(c: AppContainer, headers: Headers): Promise<Actor | null> {
  const session = await c.resolveSession(headers);
  if (!session) return null;
  const user = await c.core.users.findById(session.userId);
  if (!user) return null;
  return {
    userId: session.userId,
    role: user.role,
    mode: user.mode,
    reciterSince: user.reciterSince,
    verifiedReciter: user.verifiedReciter,
    sessionCreatedAt: session.sessionCreatedAt,
  };
}
