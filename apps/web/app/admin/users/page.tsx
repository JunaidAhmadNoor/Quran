import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { UserAdmin } from '@/components/admin/user-admin';
import { ErrorState } from '@/components/ui/states';
import { getServerContext } from '@/server/session';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('admin'))('usersTitle'), robots: { index: false } };
}

export default async function AdminUsersPage() {
  const { actor } = await getServerContext();
  if (!actor) redirect('/auth/sign-in?next=/admin/users');
  const t = await getTranslations('admin');
  if (actor.role !== 'admin') return <ErrorState title={t('usersTitle')} body={t('forbidden')} />;
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display text-4xl text-text">{t('usersTitle')}</h1>
      <p className="mt-2 mb-8 text-muted">{t('usersIntro')}</p>
      <UserAdmin selfId={actor.userId} />
    </div>
  );
}
