import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/states';

export default async function NotFound() {
  const t = await getTranslations('errors');
  return (
    <ErrorState
      title={t('notFoundTitle')}
      body={t('notFoundBody')}
      action={
        <Button asChild>
          <Link href="/">{t('goHome')}</Link>
        </Button>
      }
    />
  );
}
