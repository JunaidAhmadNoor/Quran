import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { PlaylistsPanel } from '@/components/library/playlists-panel';
import { RecitationList } from '@/components/recitations/recitation-list';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '@/components/ui/misc';
import { EmptyState } from '@/components/ui/states';
import { getServerContext, sendStaffToWork } from '@/server/session';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('library'))('title'), robots: { index: false } };
}

export default async function LibraryPage() {
  await sendStaffToWork();
  const t = await getTranslations('library');
  const tn = await getTranslations('nav');
  const { core, actor } = await getServerContext();
  if (!actor) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="mb-8 font-display text-4xl text-text">{t('title')}</h1>
        <EmptyState
          title={t('signInTitle')}
          action={
            <Button asChild>
              <Link href="/auth/sign-in?next=/library">{tn('signIn')}</Link>
            </Button>
          }
        />
      </div>
    );
  }
  const library = await core.account.library(actor, { limit: 20 });
  return (
    <div className="mx-auto max-w-4xl space-y-12 px-4 py-10">
      <h1 className="font-display text-4xl text-text">{t('title')}</h1>
      <section aria-labelledby="liked">
        <SectionHeading id="liked">{t('liked')}</SectionHeading>
        {library.likes.items.length > 0 ? (
          <RecitationList
            scope="library-likes"
            initial={library.likes}
            source={{ kind: 'likes' }}
            showSurah
            label={t('liked')}
          />
        ) : (
          <EmptyState title={t('emptyLiked')} />
        )}
      </section>
      <PlaylistsPanel initial={library.playlists} />
    </div>
  );
}
