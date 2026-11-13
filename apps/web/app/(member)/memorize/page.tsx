import { ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { sendStaffToWork } from '@/server/session';
import { getTranslations } from 'next-intl/server';
import { RangePicker } from '@/components/memorize/range-picker';
import { Card } from '@/components/ui/misc';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('memorize');
  return { title: t('title'), description: t('intro') };
}

export default async function MemorizePage() {
  await sendStaffToWork();
  const t = await getTranslations('memorize');
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="font-display text-4xl text-text">{t('title')}</h1>
      <p className="mt-2 mb-8 text-muted">{t('intro')}</p>
      <Card className="p-6">
        <RangePicker />
      </Card>
      <p className="mt-6 flex items-start gap-2 text-sm text-muted">
        <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        {t('privacy')}
      </p>
    </div>
  );
}
