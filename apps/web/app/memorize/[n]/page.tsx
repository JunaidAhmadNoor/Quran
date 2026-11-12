import { ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { RevealPractice } from '@/components/memorize/reveal-practice';
import { Card } from '@/components/ui/misc';
import { getServerContext } from '@/server/session';

interface Props {
  params: Promise<{ n: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('memorize'))('title'), robots: { index: false } };
}

export default async function PracticePage({ params, searchParams }: Props) {
  const n = Number((await params).n);
  if (!Number.isInteger(n) || n < 1 || n > 114) notFound();
  const { core } = await getServerContext();
  const text = await core.surahs.text(n);
  const sp = await searchParams;
  const from = Math.max(1, Number(sp.from) || 1);
  const to = Math.min(text.ayahs.length, Number(sp.to) || text.ayahs.length);
  if (from > to) notFound();
  const surah = core.surahs.list().items[n - 1];
  const t = await getTranslations('memorize');
  const tc = await getTranslations('common');

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-3xl text-text">
        {surah?.nameTransliterated}{' '}
        <span className="text-muted">· {tc('ayahRange', { from, to })}</span>
      </h1>
      <Card className="my-6 p-5">
        <h2 className="font-medium text-text">{t('comingTitle')}</h2>
        <p className="mt-1 text-sm text-muted">{t('comingBody')}</p>
      </Card>
      <RevealPractice ayahs={text.ayahs.slice(from - 1, to)} />
      <p className="mt-6 flex items-start gap-2 text-sm text-muted">
        <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        {t('privacy')}
      </p>
    </div>
  );
}
