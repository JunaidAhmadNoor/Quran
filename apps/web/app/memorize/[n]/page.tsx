import { MemorizationMode } from '@tilawah/contracts';
import { ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Practice } from '@/components/memorize/practice';
import { getServerContext } from '@/server/session';

interface Props {
  params: Promise<{ n: string }>;
  searchParams: Promise<{ from?: string; to?: string; mode?: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('memorize'))('title'), robots: { index: false } };
}

/** Approved recitations of exactly one ayah, for "listen then repeat" (best-liked first). */
async function singleAyahUrls(surah: number, from: number, to: number) {
  const { core, actor } = await getServerContext();
  const urls: Record<number, string> = {};
  try {
    const page = await core.recitations.list(actor, { surah, sort: 'popular', limit: 50 });
    for (const r of page.items) {
      if (r.ayahFrom === r.ayahTo && r.ayahFrom >= from && r.ayahFrom <= to)
        urls[r.ayahFrom] ??= r.stream.url;
    }
  } catch {
    // Listening is optional: the practice still works without recordings.
  }
  return urls;
}

export default async function PracticePage({ params, searchParams }: Props) {
  const n = Number((await params).n);
  if (!Number.isInteger(n) || n < 1 || n > 114) notFound();
  const { core, actor } = await getServerContext();
  const text = await core.surahs.text(n);
  const sp = await searchParams;
  const from = Math.max(1, Number(sp.from) || 1);
  const to = Math.min(text.ayahs.length, Number(sp.to) || text.ayahs.length);
  if (from > to) notFound();
  const mode = MemorizationMode.safeParse(sp.mode).data ?? 'reveal';
  const surah = core.surahs.list().items[n - 1];
  const t = await getTranslations('memorize');
  const tc = await getTranslations('common');
  const ayahs = text.ayahs
    .slice(from - 1, to)
    .map((a) => ({
      number: a.number,
      words: a.words.map(({ position, text: w }) => ({ position, text: w })),
    }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-6 font-display text-3xl text-text">
        {surah?.nameTransliterated}{' '}
        <span className="text-muted">· {tc('ayahRange', { from, to })}</span>
      </h1>
      <Practice
        // A new range is a new session.
        key={`${String(from)}-${String(to)}`}
        surah={n}
        ayahs={ayahs}
        listenUrls={await singleAyahUrls(n, from, to)}
        signedIn={actor !== null}
        initialMode={mode}
      />
      <p className="mt-6 flex items-start gap-2 text-sm text-muted">
        <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        {t('privacy')}
      </p>
    </div>
  );
}
