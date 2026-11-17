// The home page for signed-in users: quick actions, then what is new.
import type { Hadith, RecitationPage, ReciterStats } from '@tilawah/contracts';
import { BookOpen, LayoutDashboard, Library, ScrollText, Upload } from 'lucide-react';
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
  stats: z.output<typeof ReciterStats> | null;
  trending: z.output<typeof RecitationPage>;
  newest: z.output<typeof RecitationPage>;
  reciters: { id: string; name: string }[];
  hadith: (z.output<typeof Hadith> & { bookName: { en: string; ar: string; ur: string } }) | null;
}

export async function Dashboard({ me, stats, trending, newest, reciters, hadith }: Props) {
  const t = await getTranslations('home');
  const tn = await getTranslations('nav');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  const nf = new Intl.NumberFormat(locale);
  const th = await getTranslations('hadith');
  const reciter = me.mode === 'reciter';

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
              <Link href="/surahs">
                <BookOpen />
                {tn('surahs')}
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
          {hadith ? (
            <section
              aria-labelledby="hadith-today"
              className="relative overflow-hidden rounded-card border border-border bg-surface p-6"
            >
              <GirihPattern className="opacity-[0.04]" />
              <div className="relative">
                <h2
                  id="hadith-today"
                  className="flex items-center gap-2 font-display text-xl text-text"
                >
                  <ScrollText aria-hidden className="size-5 text-accent" />
                  {t('hadithOfDay')}
                </h2>
                <p className="mt-1 text-xs text-muted">
                  {hadith.bookName[locale === 'ar' || locale === 'ur' ? locale : 'en']} ·{' '}
                  {th('hadithN', { n: nf.format(hadith.number) })}
                </p>
                <p
                  lang="ar"
                  dir="rtl"
                  className="mt-4 line-clamp-6 font-quran text-xl leading-loose text-text"
                >
                  {hadith.text.ar}
                </p>
                {locale === 'ur' ? (
                  <p
                    lang="ur"
                    dir="rtl"
                    className="mt-3 line-clamp-4 font-[family-name:var(--font-nastaliq)] leading-[2.2] text-muted"
                  >
                    {hadith.text.ur}
                  </p>
                ) : locale === 'en' ? (
                  <p className="mt-3 line-clamp-5 text-sm text-muted">{hadith.text.en}</p>
                ) : null}
                <Link
                  href={`/hadith/${hadith.book}/n/${String(hadith.number)}`}
                  className="mt-4 inline-block text-sm text-primary underline-offset-4 hover:underline"
                >
                  {t('readHadith')}
                </Link>
              </div>
            </section>
          ) : null}
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
