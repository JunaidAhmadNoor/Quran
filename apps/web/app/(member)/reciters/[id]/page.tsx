import { ObjectId } from '@tilawah/contracts';
import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { RecitationList } from '@/components/recitations/recitation-list';
import { SectionHeading, VerifiedBadge } from '@/components/ui/misc';
import { EmptyState } from '@/components/ui/states';
import { getServerContext, orNotFound } from '@/server/session';

interface Props {
  params: Promise<{ id: string }>;
}

// cache(): generateMetadata and the page share one lookup per request.
const load = cache(async (id: string) => {
  if (!ObjectId.safeParse(id).success) notFound();
  const { core, actor } = await getServerContext();
  return orNotFound(core.reciters.get(actor, id, { sort: 'popular', limit: 20 }));
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { reciter } = await load((await params).id);
  return {
    title: reciter.name,
    description: reciter.bio ?? `Quran recitations by ${reciter.name} on Tilawah.`,
  };
}

export default async function ReciterPage({ params }: Props) {
  const id = (await params).id;
  const { reciter, recitations } = await load(id);
  const t = await getTranslations('reciter');
  const tc = await getTranslations('common');
  const ts = await getTranslations('surah');
  const format = await getFormatter();
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-10 flex items-center gap-5">
        <span className="flex size-20 shrink-0 items-center justify-center rounded-full border border-accent/60 bg-surface font-display text-3xl text-primary">
          {reciter.name.slice(0, 1)}
        </span>
        <div>
          <h1 className="flex items-center gap-2 font-display text-3xl text-text">
            {reciter.name}
            {reciter.verifiedReciter ? (
              <VerifiedBadge label={tc('verified')} className="[&_svg]:size-6" />
            ) : null}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {reciter.country ? `${reciter.country} · ` : ''}
            {t('since', {
              date: format.dateTime(new Date(reciter.reciterSince), {
                year: 'numeric',
                month: 'long',
              }),
            })}
          </p>
          <p className="mt-1 text-sm text-muted">
            {t('approved', { count: reciter.stats.approvedRecitations })} ·{' '}
            {tc('plays', { count: reciter.stats.totalPlays })}
          </p>
        </div>
      </header>
      {reciter.bio ? <p className="mb-10 max-w-2xl text-text">{reciter.bio}</p> : null}
      <SectionHeading>{ts('recitations')}</SectionHeading>
      {recitations.items.length > 0 ? (
        <RecitationList
          scope={`reciter-${id}`}
          initial={recitations}
          source={{ kind: 'recitations', reciterId: id, sort: 'popular' }}
          showSurah
          label={reciter.name}
        />
      ) : (
        <EmptyState title={t('empty')} />
      )}
    </div>
  );
}
