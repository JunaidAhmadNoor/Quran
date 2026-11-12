'use client';
import { useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';
import { SurahCover } from '@/components/player/surah-cover';
import { SectionHeading } from '@/components/ui/misc';
import { usePlayer } from '@/lib/player-store';
import { formatDuration } from '@/lib/utils';

const useHydrated = () =>
  useSyncExternalStore(
    (cb) => usePlayer.persist.onFinishHydration(cb),
    () => usePlayer.persist.hasHydrated(),
    () => false,
  );

/** Recently played recitations from this browser, resuming where the listener stopped. */
export function ContinueListening() {
  const t = useTranslations('home');
  const hydrated = useHydrated();
  const history = usePlayer((s) => s.history);
  if (!hydrated || history.length === 0) return null;
  return (
    <section aria-labelledby="continue" className="mb-12">
      <SectionHeading id="continue">{t('continueListening')}</SectionHeading>
      <ul className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2">
        {history.slice(0, 8).map((h) => (
          <li key={h.track.id} className="w-36 shrink-0">
            <button
              type="button"
              className="group block w-full text-start"
              onClick={() => usePlayer.getState().playQueue([h.track], 0, h.position)}
            >
              <SurahCover
                nameArabic={h.track.surahNameArabic}
                className="w-full [container-type:inline-size]"
              />
              <span className="mt-2 block truncate text-sm font-medium text-text group-hover:underline">
                {h.track.title}
              </span>
              <span className="block truncate text-xs text-muted">
                {h.track.reciterName} · {formatDuration(h.position)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
