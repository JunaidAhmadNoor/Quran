import { ObjectId } from '@tilawah/contracts';
import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { RecitationList } from '@/components/recitations/recitation-list';
import { EmptyState } from '@/components/ui/states';
import { getServerContext, orNotFound } from '@/server/session';

interface Props {
  params: Promise<{ id: string }>;
}

// cache(): generateMetadata and the page share one lookup per request.
const load = cache(async (id: string) => {
  if (!ObjectId.safeParse(id).success) notFound();
  const { core, actor } = await getServerContext();
  return orNotFound(core.playlists.get(actor, id));
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const playlist = await load((await params).id);
  return { title: playlist.name, robots: { index: playlist.isPublic } };
}

export default async function PlaylistPage({ params }: Props) {
  const playlist = await load((await params).id);
  const t = await getTranslations('library');
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-4xl text-text">{playlist.name}</h1>
      <p className="mt-1 mb-8 text-sm text-muted">
        {playlist.owner.name} · {t('items', { count: playlist.recitations.length })}
      </p>
      {playlist.recitations.length > 0 ? (
        <RecitationList
          scope={`playlist-${playlist.id}`}
          initial={{ items: playlist.recitations, nextCursor: null }}
          source={{ kind: 'likes' }}
          showSurah
          label={playlist.name}
        />
      ) : (
        <EmptyState title={t('emptyPlaylists')} />
      )}
    </div>
  );
}
