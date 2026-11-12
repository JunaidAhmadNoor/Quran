import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { AuthForm } from '@/components/auth/auth-form';
import { AuthShell } from '@/components/auth/auth-shell';
import { getServerContext } from '@/server/session';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('auth'))('signUpTitle'), robots: { index: false } };
}

export default async function SignUpPage() {
  const t = await getTranslations('auth');
  const { googleEnabled } = await getServerContext();
  return (
    <AuthShell title={t('signUpTitle')}>
      <Suspense>
        <AuthForm mode="sign-up" googleEnabled={googleEnabled} />
      </Suspense>
    </AuthShell>
  );
}
