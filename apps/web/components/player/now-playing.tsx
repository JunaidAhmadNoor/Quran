'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { currentTrack, usePlayer } from '@/lib/player-store';
import { cn } from '@/lib/utils';
import { RepeatButton, SeekBar, SpeedMenu, TransportControls } from './controls';
import { SurahCover } from './surah-cover';

const ease = [0.2, 0.8, 0.2, 1] as const;

/** Full-screen view; the cover and title move here from the bar (shared layoutId). */
export function NowPlaying() {
  const t = useTranslations('player');
  const tc = useTranslations('common');
  const expanded = usePlayer((s) => s.expanded);
  const track = usePlayer(currentTrack);
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const setExpanded = usePlayer.getState().setExpanded;
  if (!track) return null;

  return (
    <Dialog.Root open={expanded} onOpenChange={setExpanded}>
      <AnimatePresence>
        {expanded ? (
          <Dialog.Portal forceMount>
            <Dialog.Content forceMount asChild aria-describedby={undefined}>
              <m.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease }}
                className="fixed inset-0 z-50 overflow-y-auto bg-bg"
              >
                <div className="mx-auto flex min-h-full max-w-lg flex-col px-6 pt-4 pb-10">
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="text-sm font-medium tracking-wide text-muted uppercase">
                      {t('nowPlaying')}
                    </Dialog.Title>
                    <Dialog.Close asChild>
                      <Button variant="ghost" size="icon" aria-label={t('collapse')}>
                        <ChevronDown />
                      </Button>
                    </Dialog.Close>
                  </div>
                  <m.div
                    layoutId="np-cover"
                    transition={{ duration: 0.3, ease }}
                    className="mx-auto mt-6 w-full max-w-80"
                  >
                    <SurahCover
                      nameArabic={track.surahNameArabic}
                      className="w-full rounded-card [container-type:inline-size]"
                    />
                  </m.div>
                  <div className="mt-8 text-center">
                    <m.h2
                      layoutId="np-title"
                      transition={{ duration: 0.3, ease }}
                      className="font-display text-2xl text-text"
                    >
                      {track.title}
                    </m.h2>
                    <p className="mt-1 text-muted">
                      <Link
                        href={`/reciters/${track.reciterId}`}
                        onClick={() => setExpanded(false)}
                        className="hover:text-text hover:underline"
                      >
                        {track.reciterName}
                      </Link>
                      <span aria-hidden> · </span>
                      {track.surahNameEnglish} ·{' '}
                      {tc('ayahRange', { from: track.ayahFrom, to: track.ayahTo })}
                    </p>
                  </div>
                  <SeekBar className="mt-8" />
                  <div className="mt-6 flex items-center justify-between">
                    <SpeedMenu />
                    <TransportControls size="lg" />
                    <RepeatButton />
                  </div>
                  {queue.length > 1 ? (
                    <div className="mt-10">
                      <h3 className="mb-2 text-sm font-medium text-muted">{t('queue')}</h3>
                      <ol className="divide-y divide-border rounded-card border border-border bg-surface">
                        {queue.map((q, i) => (
                          <li key={q.id}>
                            <button
                              type="button"
                              onClick={() => usePlayer.getState().playQueue(queue, i)}
                              className={cn(
                                'flex w-full items-center justify-between gap-3 px-4 py-3 text-start text-sm hover:bg-surface-raised',
                                i === index && 'font-medium text-primary',
                              )}
                              aria-current={i === index ? 'true' : undefined}
                            >
                              <span className="truncate">{q.title}</span>
                              <span className="shrink-0 text-xs text-muted">{q.reciterName}</span>
                            </button>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                </div>
              </m.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}
