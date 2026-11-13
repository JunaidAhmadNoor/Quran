import type { Actor, Core } from '@tilawah/core';
import type { AppContainer } from './container';

type UserDoc = NonNullable<Awaited<ReturnType<Core['users']['findById']>>>;

/** Session → Actor, reading the user fresh so mode and role changes apply immediately. */
export async function resolveActor(c: AppContainer, headers: Headers): Promise<Actor | null> {
  return (await resolveActorWithUser(c, headers))?.actor ?? null;
}

/** The same, also returning the user record so a page can reuse it instead of loading it again. */
export async function resolveActorWithUser(
  c: AppContainer,
  headers: Headers,
): Promise<{ actor: Actor; user: UserDoc } | null> {
  const session = await c.resolveSession(headers);
  if (!session) return null;
  const user = await c.core.users.findById(session.userId);
  if (!user) return null;
  const actor: Actor = {
    userId: session.userId,
    role: user.role,
    mode: user.mode,
    reciterSince: user.reciterSince,
    verifiedReciter: user.verifiedReciter,
    sessionCreatedAt: session.sessionCreatedAt,
  };
  return { actor, user };
}
