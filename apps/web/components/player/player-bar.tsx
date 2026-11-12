'use client';
import { ChevronUp, X } from 'lucide-react';
import { m } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { currentTrack, usePlayer } from '@/lib/player-store';
import { RepeatButton, SeekBar, SpeedMenu, TransportControls } from './controls';
import { NowPlaying } from './now-playing';
import { SurahCover } from './surah-cover';

const useHydrated = () =>
  useSyncExternalStore(
    (cb) => usePlayer.persist.onFinishHydration(cb),
    () => usePlayer.persist.hasHydrated(),
    () => false,
  );

/** Fixed bottom player on every page. */
export function PlayerBar() {
  const t = useTranslations('player');
  const hydrated = useHydrated();
  const track = usePlayer(currentTrack);
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const expanded = usePlayer((s) => s.expanded);
  if (!hydrated || !track) return null;
  const progress = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <>
      <section
        aria-label={t('label')}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface"
      >
        <div className="absolute inset-x-0 top-0 h-0.5 bg-border" aria-hidden>
          <div
            className="h-full bg-primary transition-[width] duration-500 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mx-auto flex h-18 max-w-6xl items-center gap-3 px-4">
          <button
            type="button"
            onClick={() => usePlayer.getState().setExpanded(true)}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-control text-start sm:flex-initial sm:basis-72"
            aria-label={t('expand')}
          >
            {!expanded ? (
              <m.div
                layoutId="np-cover"
                className="size-12 shrink-0"
                transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <SurahCover
                  nameArabic={track.surahNameArabic}
                  className="size-12 [container-type:inline-size]"
                />
              </m.div>
            ) : (
              <div className="size-12 shrink-0" />
            )}
            <span className="min-w-0">
              <m.span
                layoutId={expanded ? undefined : 'np-title'}
                className="block truncate text-sm font-medium text-text"
              >
                {track.title}
              </m.span>
              <span className="block truncate text-xs text-muted">{track.reciterName}</span>
            </span>
          </button>

          <div className="flex flex-1 flex-col items-center gap-0.5">
            <TransportControls />
            <SeekBar className="hidden w-full max-w-md md:flex" />
          </div>

          <div className="hidden items-center gap-1 sm:flex sm:basis-72 sm:justify-end">
            <SpeedMenu />
            <RepeatButton />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => usePlayer.getState().setExpanded(true)}
              aria-label={t('expand')}
            >
              <ChevronUp />
            </Button>
          </div>
          {/* Outside the group above so it is also available on phones. */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => usePlayer.getState().close()}
            aria-label={t('close')}
            title={t('close')}
            className="shrink-0 text-muted"
          >
            <X />
          </Button>
        </div>
      </section>
      <NowPlaying />
    </>
  );
}
