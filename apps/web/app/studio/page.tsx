import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Upload } from 'lucide-react';
import { ModeSwitch } from '@/components/layout/mode-switch';
import { Button } from '@/components/ui/button';
import { Card, SectionHeading, StatusBadge } from '@/components/ui/misc';
import { EmptyState } from '@/components/ui/states';
import { formatBytes } from '@/lib/utils';
import { getServerContext } from '@/server/session';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('studio'))('title'), robots: { index: false } };
}

/** Reciter-mode dashboard: numbers, storage, and every upload with its review status. */
export default async function StudioPage() {
  const { core, actor } = await getServerContext();
  if (!actor) redirect('/auth/sign-in?next=/studio');
  const t = await getTranslations('studio');
  const tu = await getTranslations('upload');
  const tc = await getTranslations('common');
  const tn = await getTranslations('nav');
  const locale = await getLocale();

  if (!actor.reciterSince) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="mb-8 font-display text-4xl text-text">{t('title')}</h1>
        <EmptyState
          title={tu('needReciterTitle')}
          body={tu('needReciterBody')}
          action={<ModeSwitch redirect={false} />}
        />
      </div>
    );
  }
  const [stats, mine] = await Promise.all([
    core.account.reciterStats(actor),
    core.recitations.listMine(actor, { limit: 50 }),
  ]);
  const usedPct = Math.min(100, (stats.storage.usedBytes / stats.storage.quotaBytes) * 100);
  const numbers = [
    { label: t('approved'), value: stats.recitations.approved },
    { label: t('pending'), value: stats.recitations.pending },
    { label: t('plays'), value: stats.totalPlays },
    { label: t('playsWeek'), value: stats.playsLast7Days },
    { label: t('likes'), value: stats.totalLikes },
  ];
  const fmt = new Intl.NumberFormat(locale);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl text-text">{t('title')}</h1>
        <div className="flex gap-2">
          <Button asChild variant="secondary">
            <Link href={`/reciters/${actor.userId}`}>{t('publicProfile')}</Link>
          </Button>
          <Button asChild>
            <Link href="/upload">
              <Upload />
              {tn('upload')}
            </Link>
          </Button>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {numbers.map((n) => (
          <Card key={n.label} className="p-4">
            <dt className="text-xs text-muted">{n.label}</dt>
            <dd className="mt-1 font-display text-3xl text-text tabular-nums">
              {fmt.format(n.value)}
            </dd>
          </Card>
        ))}
      </dl>
      <Card className="mt-3 p-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted">{t('storage')}</span>
          <span className="text-text">
            {t('storageOf', {
              used: formatBytes(stats.storage.usedBytes, locale),
              quota: formatBytes(stats.storage.quotaBytes, locale),
            })}
          </span>
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-border"
          role="progressbar"
          aria-label={t('storage')}
          aria-valuenow={Math.round(usedPct)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full bg-primary" style={{ width: `${String(usedPct)}%` }} />
        </div>
      </Card>

      <section aria-labelledby="uploads" className="mt-12">
        <SectionHeading id="uploads">{t('uploads')}</SectionHeading>
        {mine.items.length === 0 ? (
          <EmptyState
            title={t('empty')}
            action={
              <Button asChild>
                <Link href="/upload">{tn('upload')}</Link>
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border rounded-card border border-border bg-surface">
            {mine.items.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/recitations/${r.id}`}
                    className="block truncate font-medium text-text hover:underline"
                  >
                    {r.title}
                  </Link>
                  <p className="text-sm text-muted">
                    {tc('ayahRange', { from: r.ayahFrom, to: r.ayahTo })} ·{' '}
                    {tc('plays', { count: r.playCount })}
                  </p>
                  {r.status === 'rejected' && r.moderationNote ? (
                    <p className="mt-1 text-sm text-danger">
                      {t('reason', { reason: r.moderationNote })}
                    </p>
                  ) : null}
                </div>
                <StatusBadge status={r.status}>{t(r.status)}</StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
