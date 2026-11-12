'use client';
// Owns the one HTMLAudioElement for the whole site. Lives in the root layout, so navigating
// between pages (or switching language) never interrupts playback.
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { currentTrack, toTrack, usePlayer, type Track } from '@/lib/player-store';

/** Seconds of listening after which a play is counted (or half the track when shorter). */
const PLAY_THRESHOLD_SEC = 30;
const URL_SAFETY_MS = 60_000;

const isExpired = (t: Track) =>
  t.streamExpiresAt !== null && Date.parse(t.streamExpiresAt) - Date.now() < URL_SAFETY_MS;

/** Signed URLs expire; fetch a fresh one shortly before that. */
async function freshTrack(track: Track): Promise<Track> {
  if (!isExpired(track)) return track;
  const latest = toTrack(await api.getRecitation({ params: { id: track.id } }));
  usePlayer.getState().replaceTrack(latest);
  return latest;
}

export function AudioProvider() {
  const t = useTranslations('player');
  // Kept in a ref: the effect below must run once, not again when the language changes.
  const errorMessage = useRef(t('error'));
  useEffect(() => {
    errorMessage.current = t('error');
  }, [t]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    let loadedId: string | null = null;
    const listened = { id: '', seconds: 0, last: 0, counted: false };
    const fail = () => {
      usePlayer.getState().setPlaying(false);
      toast.error(errorMessage.current);
    };

    const load = (track: Track, startAt: number) => {
      loadedId = track.id;
      freshTrack(track)
        .then((ready) => {
          if (loadedId !== ready.id) return; // another track was chosen meanwhile
          const state = usePlayer.getState();
          audio.src = ready.streamUrl;
          audio.playbackRate = state.rate;
          audio.currentTime = startAt;
          state.seekApplied();
          if (state.playing) void audio.play().catch(() => usePlayer.getState().setPlaying(false));
          if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
              title: ready.title,
              artist: ready.reciterName,
              album: `${ready.surahNameEnglish} ${String(ready.ayahFrom)}–${String(ready.ayahTo)}`,
              artwork: [{ src: '/icons/512', sizes: '512x512', type: 'image/png' }],
            });
          }
        })
        .catch(fail);
    };

    let lastProgress = 0;
    const onTime = () => {
      const state = usePlayer.getState();
      const track = currentTrack(state);
      if (track) {
        if (listened.id !== track.id)
          Object.assign(listened, {
            id: track.id,
            seconds: 0,
            last: audio.currentTime,
            counted: false,
          });
        const delta = audio.currentTime - listened.last;
        if (delta > 0 && delta < 2) listened.seconds += delta; // seeks do not count as listening
        listened.last = audio.currentTime;
        const threshold = Math.min(PLAY_THRESHOLD_SEC, (audio.duration || track.durationSec) / 2);
        if (!listened.counted && listened.seconds >= threshold) {
          listened.counted = true;
          void api.recordPlay({ params: { id: track.id } }).catch(() => undefined);
        }
      }
      const now = performance.now();
      if (now - lastProgress > 500) {
        lastProgress = now;
        state.setProgress(audio.currentTime, audio.duration);
        if ('mediaSession' in navigator && Number.isFinite(audio.duration)) {
          navigator.mediaSession.setPositionState({
            duration: audio.duration,
            position: Math.min(audio.currentTime, audio.duration),
            playbackRate: audio.playbackRate,
          });
        }
      }
    };
    const onEnded = () => {
      const action = usePlayer.getState().onEnded();
      Object.assign(listened, { seconds: 0, counted: false });
      if (action === 'restart') {
        audio.currentTime = 0;
        void audio.play();
      } else if (action === 'next') usePlayer.getState().next();
    };
    const onPlay = () => usePlayer.getState().setPlaying(true);
    const onPause = () => {
      if (!audio.ended) usePlayer.getState().setPlaying(false);
    };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', fail);

    if ('mediaSession' in navigator) {
      const ms = navigator.mediaSession;
      const p = () => usePlayer.getState();
      ms.setActionHandler('play', () => p().setPlaying(true));
      ms.setActionHandler('pause', () => p().setPlaying(false));
      ms.setActionHandler('previoustrack', () => p().previous());
      ms.setActionHandler('nexttrack', () => p().next());
      ms.setActionHandler('seekto', (d) => {
        if (d.seekTime !== undefined) p().seek(d.seekTime);
      });
      ms.setActionHandler('seekbackward', (d) =>
        p().seek(audio.currentTime - (d.seekOffset ?? 10)),
      );
      ms.setActionHandler('seekforward', (d) => p().seek(audio.currentTime + (d.seekOffset ?? 10)));
    }

    // React to store changes: track, play/pause, rate, seeks.
    const unsubscribe = usePlayer.subscribe((state, prev) => {
      const track = currentTrack(state);
      if (!track) {
        audio.pause();
        return;
      }
      if (track.id !== loadedId) {
        // New track (or the restored one after a reload): start at the requested position.
        load(track, state.pendingSeek ?? state.position);
        return;
      }
      if (state.pendingSeek !== null && state.pendingSeek !== prev.pendingSeek) {
        audio.currentTime = state.pendingSeek;
        state.seekApplied();
      }
      if (state.rate !== audio.playbackRate) audio.playbackRate = state.rate;
      if (state.playing && audio.paused && audio.src)
        void audio.play().catch(() => usePlayer.getState().setPlaying(false));
      if (!state.playing && !audio.paused) audio.pause();
      if ('mediaSession' in navigator)
        navigator.mediaSession.playbackState = state.playing ? 'playing' : 'paused';
    });

    // Restore the queue from localStorage; the subscriber loads the last track, paused, at its
    // saved position (`playing` is never persisted).
    void usePlayer.persist.rehydrate();

    return () => {
      unsubscribe();
      audio.pause();
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', fail);
    };
  }, []);

  return null;
}
