import { beforeEach, describe, expect, it } from 'vitest';
import { usePlayer, type Track } from './player-store';

const track = (id: string): Track => ({
  id,
  title: `Track ${id}`,
  reciterId: 'r',
  reciterName: 'Reciter',
  surah: 1,
  surahNameArabic: 'الفاتحة',
  surahNameEnglish: 'Al-Fatiha',
  ayahFrom: 1,
  ayahTo: 7,
  durationSec: 60,
  streamUrl: `https://storage.test/${id}.mp3`,
  streamExpiresAt: null,
});

beforeEach(() =>
  usePlayer.setState({
    queue: [],
    index: 0,
    playing: false,
    position: 0,
    repeat: 'off',
    history: [],
    pendingSeek: null,
  }),
);

describe('player store', () => {
  it('plays a queue from a chosen index and records history', () => {
    usePlayer.getState().playQueue([track('a'), track('b')], 1);
    const s = usePlayer.getState();
    expect(s.queue[s.index]?.id).toBe('b');
    expect(s.playing).toBe(true);
    expect(s.history[0]?.track.id).toBe('b');
  });

  it('moves next and stops at the end unless repeating the queue', () => {
    const { playQueue, next } = usePlayer.getState();
    playQueue([track('a'), track('b')]);
    next();
    expect(usePlayer.getState().index).toBe(1);
    next();
    expect(usePlayer.getState().index).toBe(1);
    usePlayer.setState({ repeat: 'all' });
    next();
    expect(usePlayer.getState().index).toBe(0);
  });

  it('restarts the track on "previous" after 3 seconds, otherwise goes back', () => {
    const { playQueue, next, previous } = usePlayer.getState();
    playQueue([track('a'), track('b')]);
    next();
    usePlayer.setState({ position: 10 });
    previous();
    expect(usePlayer.getState()).toMatchObject({ index: 1, pendingSeek: 0 });
    usePlayer.setState({ position: 1 });
    previous();
    expect(usePlayer.getState().index).toBe(0);
  });

  it('decides what happens when a recitation ends', () => {
    usePlayer.getState().playQueue([track('a')]);
    usePlayer.setState({ repeat: 'one' });
    expect(usePlayer.getState().onEnded()).toBe('restart');
    usePlayer.setState({ repeat: 'off' });
    expect(usePlayer.getState().onEnded()).toBe('stop');
    expect(usePlayer.getState().playing).toBe(false);
  });

  it('cycles repeat off → one → all → off', () => {
    const { cycleRepeat } = usePlayer.getState();
    cycleRepeat();
    expect(usePlayer.getState().repeat).toBe('one');
    cycleRepeat();
    expect(usePlayer.getState().repeat).toBe('all');
    cycleRepeat();
    expect(usePlayer.getState().repeat).toBe('off');
  });

  it('close empties the queue but keeps history for "continue listening"', () => {
    usePlayer.getState().playQueue([track('a'), track('b')], 1);
    usePlayer.getState().close();
    expect(usePlayer.getState()).toMatchObject({
      queue: [],
      index: 0,
      playing: false,
      position: 0,
    });
    expect(usePlayer.getState().history.map((h) => h.track.id)).toEqual(['b']);
  });
});
