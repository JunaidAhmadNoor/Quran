// The home page for signed-in users: their progress first, then what is new.
import type {
  MemorizationProgress,
  RecitationPage,
  ReciterStats,
  SurahSummary,
} from '@tilawah/contracts';
import { BookOpenCheck, LayoutDashboard, Library, Upload } from 'lucide-react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { ContinueListening } from '@/components/home/continue-listening';
import { RecitationList } from '@/components/recitations/recitation-list';
import { Button } from '@/components/ui/button';
import { Card, SectionHeading, VerifiedBadge } from '@/components/ui/misc';
import { GirihPattern, StarMark } from '@/components/ui/ornaments';
import { EmptyState } from '@/components/ui/states';
import type { Me } from '@/hooks/use-me';
import type { z } from 'zod';

interface Props {
  me: Me;
  surahs: z.output<typeof SurahSummary>[];
  progress: z.output<typeof MemorizationProgress>[];
  stats: z.output<typeof ReciterStats> | null;
  trending: z.output<typeof RecitationPage>;
  newest: z.output<typeof RecitationPage>;
  reciters: { id: string; name: string }[];
}

export async function Dashboard({
  me,
  surahs,
  progress,
  stats,
  trending,
  newest,
  reciters,
}: Props) {
  const t = await getTranslations('home');
  const tn = await getTranslations('nav');
  const tc = await getTranslations('common');
  const nf = new Intl.NumberFormat(await getLocale());
  const reciter = me.mode === 'reciter';
  const recent = [...progress]
    .sort((a, b) => Date.parse(b.lastPracticedAt) - Date.parse(a.lastPracticedAt))
    .slice(0, 4);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* Greeting and quick actions */}
      <section className="relative mb-10 overflow-hidden rounded-card border border-border bg-surface p-6 sm:p-8">
        <GirihPattern className="opacity-[0.05]" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-3xl text-text sm:text-4xl">
              {t('greeting', { name: me.name.split(' ')[0] ?? me.name })}
            </h1>
            <p className="mt-2 text-muted">{t('greetingBody')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/memorize">
                <BookOpenCheck />
                {t('quickMemorize')}
              </Link>
            </Button>
            {reciter ? (
              <>
                <Button asChild variant="secondary">
                  <Link href="/upload">
                    <Upload />
                    {t('quickUpload')}
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/studio">
                    <LayoutDashboard />
                    {t('quickStudio')}
                  </Link>
                </Button>
              </>
            ) : (
              <Button asChild variant="secondary">
                <Link href="/library">
                  <Library />
                  {tn('library')}
                </Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      <ContinueListening />

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-12">
          {/* Memorization progress */}
          <section aria-labelledby="progress">
            <SectionHeading id="progress">{t('progressTitle')}</SectionHeading>
            {recent.length === 0 ? (
              <EmptyState
                title={t('progressEmpty')}
                action={
                  <Button asChild>
                    <Link href="/memorize">{t('practiceCta')}</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {recent.map((p) => {
                  const surah = surahs[p.surah - 1];
                  const total = surah?.ayahCount ?? p.lastAyah;
                  const pct = Math.round((p.lastAyah / total) * 100);
                  const next = Math.min(total, p.lastAyah + 1);
                  return (
                    <li key={p.surah}>
                      <Card className="flex h-full flex-col p-5">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="font-medium text-text">{surah?.nameTransliterated}</span>
                          <span lang="ar" className="font-quran text-xl text-muted">
                            {surah?.nameArabic}
                          </span>
                        </div>
                        <div
                          role="progressbar"
                          aria-label={surah?.nameTransliterated}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={pct}
                          className="mt-4 h-2 overflow-hidden rounded-full bg-border"
                        >
                          <div className="h-full bg-primary" style={{ width: `${String(pct)}%` }} />
                        </div>
                        <div className="mt-2 flex justify-between text-xs text-muted">
                          <span>
                            {t('progressAyahs', {
                              last: nf.format(p.lastAyah),
                              total: nf.format(total),
                            })}
                          </span>
                          <span>
                            {t('progressBest', { pct: Math.round(p.bestAccuracy * 100) })}
                          </span>
                        </div>
                        <Link
                          href={`/memorize/${String(p.surah)}?from=${String(p.lastAyah >= total ? 1 : next)}&to=${String(total)}`}
                          className="mt-4 text-sm text-primary underline-offset-4 hover:underline"
                        >
                          {t('progressContinue')}
                        </Link>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="popular">
            <SectionHeading id="popular">{t('popularWeek')}</SectionHeading>
            {trending.items.length > 0 ? (
              <RecitationList
                scope="home-trending"
                initial={trending}
                source={{ kind: 'recitations', sort: 'trending' }}
                showSurah
                label={t('popularWeek')}
              />
            ) : (
              <EmptyState title={t('emptyPopular')} />
            )}
          </section>
          <section aria-labelledby="new">
            <SectionHeading id="new">{t('newUploads')}</SectionHeading>
            {newest.items.length > 0 ? (
              <RecitationList
                scope="home-newest"
                initial={newest}
                source={{ kind: 'recitations', sort: 'newest' }}
                showSurah
                label={t('newUploads')}
              />
            ) : (
              <EmptyState title={t('emptyNew')} />
            )}
          </section>
        </div>

        <aside className="space-y-8">
          {stats ? (
            <Card className="p-6">
              <h2 className="font-display text-xl text-text">{t('studioTitle')}</h2>
              <ul className="mt-4 space-y-2 text-sm">
                <li className="flex justify-between">
                  <span className="text-muted">
                    {t('studioApproved', { n: nf.format(stats.recitations.approved) })}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted">
                    {t('studioPending', { n: nf.format(stats.recitations.pending) })}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted">
                    {t('studioPlays', { n: nf.format(stats.playsLast7Days) })}
                  </span>
                </li>
              </ul>
              <Button asChild variant="secondary" className="mt-5 w-full">
                <Link href="/studio">{t('quickStudio')}</Link>
              </Button>
            </Card>
          ) : null}
          <section aria-labelledby="reciters">
            <SectionHeading id="reciters">{t('verifiedReciters')}</SectionHeading>
            {reciters.length > 0 ? (
              <ul className="space-y-2">
                {reciters.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/reciters/${r.id}`}
                      className="flex items-center gap-3 rounded-control p-2 hover:bg-surface-raised"
                    >
                      <span className="flex size-10 items-center justify-center rounded-full border border-border bg-surface text-sm font-semibold text-primary">
                        {r.name.slice(0, 1)}
                      </span>
                      <span className="flex min-w-0 items-center gap-1 text-sm font-medium text-text">
                        <span className="truncate">{r.name}</span>
                        <VerifiedBadge label={tc('verified')} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted">
                <StarMark className="size-5 text-accent" />
                {t('emptyReciters')}
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
