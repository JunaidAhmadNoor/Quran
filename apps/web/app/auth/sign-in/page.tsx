import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { AuthForm } from '@/components/auth/auth-form';
import { AuthShell } from '@/components/auth/auth-shell';
import { getServerContext } from '@/server/session';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('auth'))('signInTitle'), robots: { index: false } };
}

export default async function SignInPage() {
  const t = await getTranslations('auth');
  const { googleEnabled } = await getServerContext();
  return (
    <AuthShell title={t('signInTitle')}>
      <Suspense>
        <AuthForm mode="sign-in" googleEnabled={googleEnabled} />
      </Suspense>
    </AuthShell>
  );
}
