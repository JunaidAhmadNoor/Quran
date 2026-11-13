// Every page in this group needs an account. proxy.ts already redirects visitors without a session
// cookie; this verifies the session itself (an expired or revoked one also goes to sign-in).
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getServerContext } from '@/server/session';

export default async function MemberLayout({ children }: { children: ReactNode }) {
  const { actor } = await getServerContext();
  if (!actor) {
    const path = (await headers()).get('x-pathname') ?? '/';
    redirect(`/auth/sign-in?next=${encodeURIComponent(path)}`);
  }
  return children;
}
