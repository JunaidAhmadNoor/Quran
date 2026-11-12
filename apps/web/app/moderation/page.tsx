import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ModerationQueue } from '@/components/moderation/moderation-queue';
import { ErrorState } from '@/components/ui/states';
import { getServerContext } from '@/server/session';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('moderation'))('title'), robots: { index: false } };
}

export default async function ModerationPage() {
  const { core, actor } = await getServerContext();
  if (!actor) redirect('/auth/sign-in?next=/moderation');
  const t = await getTranslations('moderation');
  if (actor.role !== 'moderator' && actor.role !== 'admin') {
    return <ErrorState title={t('title')} body={t('forbidden')} />;
  }
  const initial = await core.moderation.queue(actor, { kind: 'recitations', limit: 20 });
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-8 font-display text-4xl text-text">{t('title')}</h1>
      <ModerationQueue initial={initial} />
    </div>
  );
}
