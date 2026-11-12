import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { QuranText } from '@/components/surah/quran-text';
import { SurahRecitations, SurahViewTabs } from '@/components/surah/surah-tabs';
import { GirihPattern } from '@/components/ui/ornaments';
import { getServerContext } from '@/server/session';

interface Props {
  params: Promise<{ n: string }>;
  searchParams: Promise<{ view?: string }>;
}

const parse = (n: string) => {
  const num = Number(n);
  return Number.isInteger(num) && num >= 1 && num <= 114 ? num : null;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const n = parse((await params).n);
  if (!n) return {};
  const { core } = await getServerContext();
  const surah = core.surahs.list().items[n - 1];
  if (!surah) return {};
  return {
    title: `${surah.nameTransliterated} (${surah.nameArabic})`,
    description: `${surah.nameEnglish} — ${String(surah.ayahCount)} ayahs. Community recitations and the verified Uthmani text.`,
  };
}

export default async function SurahPage({ params, searchParams }: Props) {
  const n = parse((await params).n);
  const view = (await searchParams).view === 'read' ? 'read' : 'recitations';
  if (!n) notFound();
  const t = await getTranslations('surah');
  const tc = await getTranslations('common');
  const ts = await getTranslations('surahs');
  const { core, actor } = await getServerContext();
  // Only the active view's data is loaded: the full text of a long surah is a large payload.
  const [{ surah, recitations }, text] = await Promise.all([
    core.surahs.get(actor, n, { sort: 'popular', limit: 20 }),
    view === 'read' ? core.surahs.text(n) : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <header className="relative mb-8 overflow-hidden rounded-card border border-border bg-surface px-6 py-10 text-center">
        <GirihPattern />
        <p className="relative text-sm text-muted">{tc('surahN', { n: surah.number })}</p>
        <h1 className="relative mt-2">
          <span lang="ar" dir="rtl" className="block font-quran text-5xl leading-snug text-text">
            {surah.nameArabic}
          </span>
          <span className="mt-2 block font-display text-3xl text-text">
            {surah.nameTransliterated}
          </span>
        </h1>
        <p className="relative mt-1 text-muted">{surah.nameEnglish}</p>
        <p className="relative mt-4 text-sm text-muted">
          {tc('ayahs', { count: surah.ayahCount })} ·{' '}
          {surah.revelationPlace === 'meccan' ? t('meccan') : t('medinan')} · {ts('juz')}{' '}
          {surah.juz.length > 1
            ? `${String(surah.juz[0])}–${String(surah.juz.at(-1))}`
            : String(surah.juz[0])}
        </p>
      </header>
      <SurahViewTabs surah={n} view={view} />
      <div className="pt-6">
        {text ? (
          <QuranText
            bismillah={text.bismillah}
            ayahs={text.ayahs}
            markerLabel={(a) => t('ayahMarker', { n: a })}
          />
        ) : (
          <SurahRecitations surah={n} initial={recitations} />
        )}
      </div>
    </div>
  );
}
