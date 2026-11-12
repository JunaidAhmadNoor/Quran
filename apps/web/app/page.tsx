import { BookOpenCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ContinueListening } from '@/components/home/continue-listening';
import { RecitationList } from '@/components/recitations/recitation-list';
import { Button } from '@/components/ui/button';
import { Card, SectionHeading, VerifiedBadge } from '@/components/ui/misc';
import { StarMark } from '@/components/ui/ornaments';
import { EmptyState } from '@/components/ui/states';
import { getServerContext } from '@/server/session';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('home');
  return { title: { absolute: t('metaTitle') }, description: t('heroBody') };
}

export default async function HomePage() {
  const t = await getTranslations('home');
  const tc = await getTranslations('common');
  const { core, actor } = await getServerContext();
  const [trending, newest, reciters] = await Promise.all([
    core.recitations.list(actor, { sort: 'trending', limit: 6 }),
    core.recitations.list(actor, { sort: 'newest', limit: 6 }),
    core.reciters.listVerified({ limit: 8 }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <section className="mb-12 max-w-2xl">
        <h1 className="font-display text-4xl leading-tight text-text sm:text-5xl">
          {t('heroTitle')}
        </h1>
        <p className="mt-4 text-lg text-muted">{t('heroBody')}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/surahs">{t('browse')}</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/memorize">{t('practiceCta')}</Link>
          </Button>
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
          <Card className="p-6">
            <BookOpenCheck aria-hidden className="mb-3 size-6 text-primary" />
            <h2 className="font-display text-xl text-text">{t('practiceTitle')}</h2>
            <p className="mt-2 text-sm text-muted">{t('practiceBody')}</p>
            <Button asChild className="mt-4">
              <Link href="/memorize">{t('practiceCta')}</Link>
            </Button>
          </Card>
          <section aria-labelledby="reciters">
            <SectionHeading id="reciters">{t('verifiedReciters')}</SectionHeading>
            {reciters.items.length > 0 ? (
              <ul className="space-y-2">
                {reciters.items.map((r) => (
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
