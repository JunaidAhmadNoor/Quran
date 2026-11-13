import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { UserAdmin } from '@/components/admin/user-admin';
import { Card } from '@/components/ui/misc';
import { ErrorState } from '@/components/ui/states';
import { formatBytes } from '@/lib/utils';
import { getServerContext } from '@/server/session';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('admin'))('usersTitle'), robots: { index: false } };
}

export default async function AdminUsersPage() {
  const { core, actor } = await getServerContext();
  if (!actor) redirect('/auth/sign-in?next=/admin/users');
  const t = await getTranslations('admin');
  if (actor.role !== 'admin') return <ErrorState title={t('usersTitle')} body={t('forbidden')} />;
  const locale = await getLocale();
  const nf = new Intl.NumberFormat(locale);
  const [stats, firstPage] = await Promise.all([
    core.admin.stats(actor),
    core.admin.listUsers(actor, { limit: 25 }),
  ]);
  const cards = [
    {
      label: t('statUsers'),
      value: nf.format(stats.users.total),
      detail: t('statNew', { n: nf.format(stats.users.newLast7Days) }),
    },
    {
      label: t('statReciters'),
      value: nf.format(stats.users.reciters),
      detail: t('statVerified', { n: nf.format(stats.users.verifiedReciters) }),
    },
    {
      label: t('statStaff'),
      value: nf.format(stats.users.moderators + stats.users.admins),
      detail: t('statStaffDetail', {
        mods: nf.format(stats.users.moderators),
        admins: nf.format(stats.users.admins),
      }),
    },
    { label: t('statUnverified'), value: nf.format(stats.users.emailNotVerified) },
    {
      label: t('statRecitations'),
      value: nf.format(stats.recitations.approved),
      detail: t('statPending', { n: nf.format(stats.recitations.pending) }),
    },
    { label: t('statReports'), value: nf.format(stats.openReports) },
    { label: t('statPlays'), value: nf.format(stats.playsLast7Days) },
    { label: t('statStorage'), value: formatBytes(stats.storageBytes, locale) },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-4xl text-text">{t('usersTitle')}</h1>
      <p className="mt-2 mb-8 max-w-2xl text-muted">{t('usersIntro')}</p>

      <section aria-labelledby="overview" className="mb-10">
        <h2 id="overview" className="sr-only">
          {t('overview')}
        </h2>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {cards.map((c) => (
            <li key={c.label}>
              <Card className="h-full p-4">
                <p className="text-xs text-muted">{c.label}</p>
                <p className="mt-1 font-display text-2xl text-text tabular-nums">{c.value}</p>
                {c.detail ? <p className="mt-1 text-xs text-muted">{c.detail}</p> : null}
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <UserAdmin selfId={actor.userId} initial={firstPage} />
    </div>
  );
}
