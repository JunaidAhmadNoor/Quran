import { ObjectId } from '@tilawah/contracts';
import { getSurahMeta } from '@tilawah/quran-data';
import type { Metadata } from 'next';
import { cache } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { RecitationPlayer } from '@/components/recitations/recitation-header';
import { RecitationList } from '@/components/recitations/recitation-list';
import { ReportDialog } from '@/components/recitations/report-dialog';
import { Card, SectionHeading, VerifiedBadge } from '@/components/ui/misc';
import { getServerContext, orNotFound } from '@/server/session';

interface Props {
  params: Promise<{ id: string }>;
}

// cache(): generateMetadata and the page share one lookup per request.
const load = cache(async (id: string) => {
  if (!ObjectId.safeParse(id).success) notFound();
  const { core, actor } = await getServerContext();
  return { core, actor, recitation: await orNotFound(core.recitations.get(actor, id)) };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { recitation } = await load((await params).id);
  const surah = getSurahMeta(recitation.surah);
  return {
    title: `${recitation.title} — ${recitation.reciter.name}`,
    description: `${surah?.nameTransliterated ?? ''} ${String(recitation.ayahFrom)}–${String(recitation.ayahTo)}, recited by ${recitation.reciter.name}.`,
  };
}

export default async function RecitationPage({ params }: Props) {
  const { core, actor, recitation } = await load((await params).id);
  const t = await getTranslations('recitation');
  const tc = await getTranslations('common');
  const styles = await getTranslations('styles');
  const riwayat = await getTranslations('riwayat');
  const format = await getFormatter();
  const surah = getSurahMeta(recitation.surah);
  const more = await core.recitations.list(actor, {
    reciterId: recitation.reciter.id,
    sort: 'popular',
    limit: 6,
  });
  const others = { ...more, items: more.items.filter((r) => r.id !== recitation.id) };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      {recitation.status !== 'approved' ? (
        <p
          role="status"
          className="mb-6 rounded-card border border-border bg-surface px-4 py-3 text-sm text-muted"
        >
          {recitation.status === 'pending'
            ? t('pendingNotice')
            : recitation.status === 'rejected'
              ? t('rejectedNotice', { reason: recitation.moderationNote ?? '' })
              : t('removedNotice')}
        </p>
      ) : null}
      <header className="mb-8">
        <p className="text-sm text-muted">
          <Link
            href={`/surahs/${String(recitation.surah)}`}
            className="hover:text-text hover:underline"
          >
            {surah?.nameTransliterated}
          </Link>{' '}
          · {tc('ayahRange', { from: recitation.ayahFrom, to: recitation.ayahTo })}
        </p>
        <h1 className="mt-1 font-display text-4xl text-text">{recitation.title}</h1>
      </header>
      <Card className="p-6">
        <RecitationPlayer recitation={recitation} />
      </Card>

      <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-[minmax(0,1fr)_16rem]">
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted">{t('style')}</dt>
            <dd className="text-text">{styles(recitation.style)}</dd>
          </div>
          <div>
            <dt className="text-muted">{t('riwayah')}</dt>
            <dd className="text-text">{riwayat(recitation.riwayah)}</dd>
          </div>
          <div>
            <dt className="text-muted">{tc('plays', { count: recitation.playCount })}</dt>
            <dd className="text-text">
              {format.dateTime(new Date(recitation.createdAt), { dateStyle: 'medium' })}
            </dd>
          </div>
        </dl>
        <Card className="p-4">
          <Link href={`/reciters/${recitation.reciter.id}`} className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-full border border-border bg-bg font-semibold text-primary">
              {recitation.reciter.name.slice(0, 1)}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1 font-medium text-text">
                <span className="truncate">{recitation.reciter.name}</span>
                {recitation.reciter.verifiedReciter ? (
                  <VerifiedBadge label={tc('verified')} />
                ) : null}
              </span>
              {recitation.reciter.country ? (
                <span className="text-xs text-muted">{recitation.reciter.country}</span>
              ) : null}
            </span>
          </Link>
          <div className="mt-3 border-t border-border pt-2">
            <ReportDialog id={recitation.id} />
          </div>
        </Card>
      </div>

      {others.items.length > 0 ? (
        <section aria-labelledby="more" className="mt-12">
          <SectionHeading id="more">
            {t('moreBy', { name: recitation.reciter.name })}
          </SectionHeading>
          <RecitationList
            scope={`more-by-${recitation.id}`}
            initial={{ ...others, nextCursor: null }}
            source={{ kind: 'recitations', reciterId: recitation.reciter.id, sort: 'popular' }}
            showSurah
            label={t('moreBy', { name: recitation.reciter.name })}
          />
        </section>
      ) : null}
    </div>
  );
}
