'use client';
import { useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import type { CSSProperties } from 'react';
import { Button } from '@/components/ui/button';
import { VerifiedBadge } from '@/components/ui/misc';
import { PlayPauseIcon } from '@/components/player/play-icon';
import { api } from '@/lib/api';
import { currentTrack, toTrack, usePlayer } from '@/lib/player-store';
import { cn, formatDuration } from '@/lib/utils';
import { LikeButton } from './like-button';
import { RecitationMenu } from './playlist-menu';
import type { ListSource, Page, RecitationItem } from './types';

async function fetchPage(source: ListSource, cursor: string | undefined): Promise<Page> {
  const limit = 20;
  switch (source.kind) {
    case 'recitations':
      return api.listRecitations({
        query: {
          surah: source.surah,
          reciterId: source.reciterId,
          sort: source.sort,
          cursor,
          limit,
        },
      });
    case 'likes':
      return (await api.getLibrary({ query: { cursor, limit } })).likes;
    case 'mine':
      return api.listMyRecitations({ query: { status: source.status, cursor, limit } });
  }
}

interface ListProps {
  initial: Page;
  source: ListSource;
  /** Show the surah name (lists that mix surahs). */
  showSurah?: boolean;
  label: string;
  /** Identifies this list in the query cache; two lists with the same source must not share data. */
  scope: string;
}

export function RecitationList({ initial, source, showSurah = false, label, scope }: ListProps) {
  const tc = useTranslations('common');
  const query = useInfiniteQuery({
    queryKey: ['recitation-list', scope, source],
    queryFn: ({ pageParam }) => fetchPage(source, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    initialData: { pages: [initial], pageParams: [undefined] },
  });
  const items = query.data.pages.flatMap((p) => p.items);
  const firstCount = initial.items.length;

  return (
    <div>
      <ul
        aria-label={label}
        className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface"
      >
        {items.map((item, i) => (
          <li
            key={item.id}
            // Stagger by 30 ms on first load only; items from later pages appear without animation.
            className={i < firstCount ? 'animate-stagger' : undefined}
            style={i < firstCount ? ({ '--i': Math.min(i, 12) } as CSSProperties) : undefined}
          >
            <RecitationRow item={item} queue={items} index={i} showSurah={showSurah} />
          </li>
        ))}
      </ul>
      {query.hasNextPage ? (
        <div className="mt-4 flex justify-center">
          <Button
            variant="secondary"
            onClick={() => void query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            {tc('loadMore')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function RecitationRow({
  item,
  queue,
  index,
  showSurah,
}: {
  item: RecitationItem;
  queue: RecitationItem[];
  index: number;
  showSurah: boolean;
}) {
  const tc = useTranslations('common');
  const tr = useTranslations('recitation');
  const locale = useLocale();
  const isCurrent = usePlayer((s) => currentTrack(s)?.id === item.id);
  const playing = usePlayer((s) => s.playing);
  const track = toTrack(item);

  const onPlay = () => {
    if (isCurrent) usePlayer.getState().toggle();
    else usePlayer.getState().playQueue(queue.map(toTrack), index);
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 transition-colors duration-150 hover:bg-surface-raised sm:px-4',
        isCurrent && 'bg-surface-raised',
      )}
    >
      <Button
        variant={isCurrent ? 'primary' : 'secondary'}
        size="icon"
        className="shrink-0 rounded-full"
        onClick={onPlay}
        aria-label={`${isCurrent && playing ? tc('pause') : tc('play')}: ${item.title}`}
      >
        <PlayPauseIcon playing={isCurrent && playing} />
      </Button>
      <div className="min-w-0 flex-1">
        <Link
          href={`/recitations/${item.id}`}
          className="block truncate font-medium text-text hover:underline"
        >
          {item.title}
        </Link>
        <p className="flex items-center gap-1 truncate text-sm text-muted">
          <Link
            href={`/reciters/${item.reciter.id}`}
            className="inline-flex min-h-6 min-w-0 items-center truncate hover:text-text hover:underline"
          >
            {item.reciter.name}
          </Link>
          {item.reciter.verifiedReciter ? <VerifiedBadge label={tc('verified')} /> : null}
          <span aria-hidden>·</span>
          <span className="shrink-0">
            {showSurah
              ? `${locale === 'en' ? track.surahNameEnglish : track.surahNameArabic} `
              : ''}
            {item.ayahFrom === item.ayahTo
              ? tc('ayahSingle', { n: item.ayahFrom })
              : tc('ayahRange', { from: item.ayahFrom, to: item.ayahTo })}
          </span>
        </p>
      </div>
      <span className="hidden text-sm tabular-nums text-muted sm:block" aria-label={tr('duration')}>
        {formatDuration(item.durationSec)}
      </span>
      <LikeButton id={item.id} liked={item.viewer?.liked ?? false} count={item.likeCount} />
      <RecitationMenu id={item.id} />
    </div>
  );
}
