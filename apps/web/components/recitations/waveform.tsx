'use client';
// Waveform with seek preview. Decoding audio for the peaks is expensive, so a light placeholder
// is shown first and the real waveform is built on intent: the pointer reaches it, it is touched,
// or this recitation starts playing. Playback always goes through the one global player.
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import { currentTrack, usePlayer, type Track } from '@/lib/player-store';

const BARS = 72;

/** Deterministic, speech-like bar heights for the placeholder (no audio decoding). */
function placeholderBars(seed: string): number[] {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return Array.from({ length: BARS }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0;
    const phrase = Math.abs(Math.sin((i / BARS) * Math.PI * 4));
    return 0.2 + 0.8 * phrase * (0.55 + ((h % 1000) / 1000) * 0.45);
  });
}

export function Waveform({ track }: { track: Track }) {
  const t = useTranslations('recitation');
  const container = useRef<HTMLDivElement>(null);
  const ws = useRef<WaveSurfer | null>(null);
  const isCurrent = usePlayer((s) => currentTrack(s)?.id === track.id);
  const [wanted, setWanted] = useState(false);
  const active = wanted || isCurrent;
  const bars = useMemo(() => placeholderBars(track.id), [track.id]);

  useEffect(() => {
    if (!active) return;
    let destroyed = false;
    void import('wavesurfer.js').then(({ default: WS }) => {
      if (destroyed || !container.current) return;
      const styles = getComputedStyle(document.documentElement);
      const instance = WS.create({
        container: container.current,
        url: track.streamUrl,
        height: 72,
        barWidth: 2,
        barGap: 2,
        barRadius: 2,
        cursorWidth: 0,
        normalize: true,
        waveColor: styles.getPropertyValue('--border').trim() || '#E2D8C6',
        progressColor: styles.getPropertyValue('--primary').trim() || '#1E4D45',
        interact: true,
      });
      instance.setMuted(true);
      instance.on('interaction', (time) => {
        const player = usePlayer.getState();
        if (currentTrack(player)?.id === track.id) player.seek(time);
        else player.playQueue([track], 0, time);
      });
      ws.current = instance;
    });
    // Mirror the global player's progress while this recitation is the one playing.
    const unsubscribe = usePlayer.subscribe((s) => {
      if (currentTrack(s)?.id === track.id && ws.current) ws.current.setTime(s.position);
    });
    return () => {
      destroyed = true;
      unsubscribe();
      ws.current?.destroy();
      ws.current = null;
    };
  }, [active, track]);

  return (
    <div
      ref={container}
      role="img"
      aria-label={t('waveform')}
      className="relative h-[72px] w-full cursor-pointer"
      dir="ltr"
      onPointerEnter={() => setWanted(true)}
      onTouchStart={() => setWanted(true)}
    >
      {!active ? (
        <div aria-hidden className="absolute inset-0 flex items-center gap-[2px]">
          {bars.map((height, i) => (
            <span
              key={i}
              className="flex-1 rounded-full bg-border"
              style={{ height: `${String(Math.round(height * 100))}%` }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
