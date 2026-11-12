'use client';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { PlayPauseIcon } from '@/components/player/play-icon';
import { SurahCover } from '@/components/player/surah-cover';
import { currentTrack, toTrack, usePlayer } from '@/lib/player-store';
import { formatDuration } from '@/lib/utils';
import { LikeButton } from './like-button';
import type { RecitationItem } from './types';
import { Waveform } from './waveform';

export function RecitationPlayer({ recitation }: { recitation: RecitationItem }) {
  const tc = useTranslations('common');
  const track = toTrack(recitation);
  const isCurrent = usePlayer((s) => currentTrack(s)?.id === recitation.id);
  const playing = usePlayer((s) => s.playing);
  const play = () => {
    if (isCurrent) usePlayer.getState().toggle();
    else usePlayer.getState().playQueue([track]);
  };
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
      <SurahCover
        nameArabic={track.surahNameArabic}
        className="w-40 shrink-0 rounded-card [container-type:inline-size]"
      />
      <div className="min-w-0 flex-1 space-y-4">
        <Waveform track={track} />
        <div className="flex items-center gap-3">
          <Button
            size="lg"
            className="rounded-full"
            onClick={play}
            aria-label={isCurrent && playing ? tc('pause') : tc('play')}
          >
            <PlayPauseIcon playing={isCurrent && playing} />
            {isCurrent && playing ? tc('pause') : tc('play')}
          </Button>
          <LikeButton
            id={recitation.id}
            liked={recitation.viewer?.liked ?? false}
            count={recitation.likeCount}
            showCount
          />
          <span className="ms-auto text-sm tabular-nums text-muted">
            {formatDuration(recitation.durationSec)}
          </span>
        </div>
      </div>
    </div>
  );
}
