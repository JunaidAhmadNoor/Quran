'use client';
// Player state shared by the bar, the full-screen view and every play button. Persisted to
// localStorage so "continue listening" and the queue survive reloads.
import type { Recitation } from '@tilawah/contracts';
import { getSurahMeta } from '@tilawah/quran-data';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface Track {
  id: string;
  title: string;
  reciterId: string;
  reciterName: string;
  surah: number;
  surahNameArabic: string;
  surahNameEnglish: string;
  ayahFrom: number;
  ayahTo: number;
  durationSec: number;
  streamUrl: string;
  /** ISO time the signed URL expires; null for permanent URLs. */
  streamExpiresAt: string | null;
}

export type RepeatMode = 'off' | 'one' | 'all';
export const SPEEDS = [0.75, 1, 1.25, 1.5] as const;

export function toTrack(r: Recitation): Track {
  const meta = getSurahMeta(r.surah);
  return {
    id: r.id,
    title: r.title,
    reciterId: r.reciter.id,
    reciterName: r.reciter.name,
    surah: r.surah,
    surahNameArabic: meta?.nameArabic ?? '',
    surahNameEnglish: meta?.nameTransliterated ?? '',
    ayahFrom: r.ayahFrom,
    ayahTo: r.ayahTo,
    durationSec: r.durationSec,
    streamUrl: r.stream.url,
    streamExpiresAt: r.stream.expiresAt,
  };
}

interface HistoryEntry {
  track: Track;
  position: number;
  at: number;
}

interface PlayerState {
  queue: Track[];
  index: number;
  playing: boolean;
  position: number;
  duration: number;
  rate: number;
  repeat: RepeatMode;
  expanded: boolean;
  /** A seek the audio element has not applied yet. */
  pendingSeek: number | null;
  history: HistoryEntry[];
  playQueue: (tracks: Track[], startIndex?: number, startAt?: number) => void;
  toggle: () => void;
  setPlaying: (playing: boolean) => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  seekApplied: () => void;
  setProgress: (position: number, duration: number) => void;
  setRate: (rate: number) => void;
  cycleRepeat: () => void;
  setExpanded: (expanded: boolean) => void;
  replaceTrack: (track: Track) => void;
  onEnded: () => 'restart' | 'next' | 'stop';
}

const HISTORY_SIZE = 12;

const remember = (history: HistoryEntry[], track: Track, position: number): HistoryEntry[] =>
  [{ track, position, at: Date.now() }, ...history.filter((h) => h.track.id !== track.id)].slice(
    0,
    HISTORY_SIZE,
  );

export const usePlayer = create<PlayerState>()(
  persist(
    (set, get) => ({
      queue: [],
      index: 0,
      playing: false,
      position: 0,
      duration: 0,
      rate: 1,
      repeat: 'off',
      expanded: false,
      pendingSeek: null,
      history: [],

      playQueue: (tracks, startIndex = 0, startAt = 0) => {
        const track = tracks[startIndex];
        if (!track) return;
        set((s) => ({
          queue: tracks,
          index: startIndex,
          playing: true,
          position: startAt,
          duration: track.durationSec,
          pendingSeek: startAt > 0 ? startAt : null,
          history: remember(s.history, track, startAt),
        }));
      },
      toggle: () => {
        if (get().queue.length > 0) set((s) => ({ playing: !s.playing }));
      },
      setPlaying: (playing) => set({ playing }),
      next: () => {
        const { index, queue, repeat } = get();
        const nextIndex = index + 1 < queue.length ? index + 1 : repeat === 'all' ? 0 : -1;
        const track = queue[nextIndex];
        if (!track) return;
        set((s) => ({
          index: nextIndex,
          position: 0,
          playing: true,
          history: remember(s.history, track, 0),
        }));
      },
      previous: () => {
        const { index, position, queue } = get();
        // Like most players: restart the track unless it has only just begun.
        if (position > 3 || index === 0) {
          set({ pendingSeek: 0, position: 0 });
          return;
        }
        const track = queue[index - 1];
        if (track)
          set((s) => ({
            index: index - 1,
            position: 0,
            playing: true,
            history: remember(s.history, track, 0),
          }));
      },
      seek: (seconds) => set({ pendingSeek: Math.max(0, seconds), position: Math.max(0, seconds) }),
      seekApplied: () => set({ pendingSeek: null }),
      setProgress: (position, duration) => {
        const track = get().queue[get().index];
        set((s) => ({
          position,
          duration: Number.isFinite(duration) && duration > 0 ? duration : s.duration,
          history: track ? remember(s.history, track, position) : s.history,
        }));
      },
      setRate: (rate) => set({ rate }),
      cycleRepeat: () =>
        set((s) => ({ repeat: s.repeat === 'off' ? 'one' : s.repeat === 'one' ? 'all' : 'off' })),
      setExpanded: (expanded) => set({ expanded }),
      replaceTrack: (track) =>
        set((s) => ({ queue: s.queue.map((t) => (t.id === track.id ? track : t)) })),
      onEnded: () => {
        const { repeat, index, queue } = get();
        if (repeat === 'one') return 'restart';
        if (index + 1 < queue.length || repeat === 'all') return 'next';
        set({ playing: false });
        return 'stop';
      },
    }),
    {
      name: 'tilawah-player',
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        queue: s.queue,
        index: s.index,
        position: s.position,
        rate: s.rate,
        repeat: s.repeat,
        history: s.history,
      }),
    },
  ),
);

export const currentTrack = (s: Pick<PlayerState, 'queue' | 'index'>): Track | undefined =>
  s.queue[s.index];
