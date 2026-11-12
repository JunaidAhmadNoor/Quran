'use client';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/states';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('errors');
  const tc = useTranslations('common');
  return (
    <ErrorState
      title={t('genericTitle')}
      body={t('genericBody')}
      action={<Button onClick={reset}>{tc('retry')}</Button>}
    />
  );
}
