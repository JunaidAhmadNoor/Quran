import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { AuthShell } from '@/components/auth/auth-shell';
import { ResetForm } from '@/components/auth/reset-form';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('auth'))('resetTitle'), robots: { index: false } };
}

export default async function ResetPasswordPage() {
  const t = await getTranslations('auth');
  return (
    <AuthShell title={t('resetTitle')} body={t('resetBody')}>
      <Suspense>
        <ResetForm />
      </Suspense>
    </AuthShell>
  );
}
