import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SurahGrid } from '@/components/surahs/surah-grid';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('surahs');
  return { title: t('title'), description: t('metaDescription') };
}

export default async function SurahsPage() {
  const t = await getTranslations('surahs');
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 font-display text-4xl text-text">{t('title')}</h1>
      <SurahGrid />
    </div>
  );
}
