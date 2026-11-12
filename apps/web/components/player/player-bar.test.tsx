import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { usePlayer, type Track } from '@/lib/player-store';
import { renderWithProviders } from '@/test/render';
import { PlayerBar } from './player-bar';

const track: Track = {
  id: 't1',
  title: 'Al-Mulk, evening',
  reciterId: 'r1',
  reciterName: 'Yusuf',
  surah: 67,
  surahNameArabic: 'الملك',
  surahNameEnglish: 'Al-Mulk',
  ayahFrom: 1,
  ayahTo: 30,
  durationSec: 600,
  streamUrl: 'https://storage.test/t1.mp3',
  streamExpiresAt: null,
};

beforeEach(async () => {
  await usePlayer.persist.rehydrate();
  usePlayer.setState({
    queue: [],
    index: 0,
    playing: false,
    position: 0,
    duration: 600,
    rate: 1,
    repeat: 'off',
    expanded: false,
  });
});

describe('PlayerBar', () => {
  it('is hidden until something is queued', () => {
    renderWithProviders(<PlayerBar />);
    expect(screen.queryByRole('region', { name: 'Audio player' })).not.toBeInTheDocument();
  });

  it('shows the track and toggles play/pause from the keyboard', async () => {
    renderWithProviders(<PlayerBar />);
    act(() => usePlayer.getState().playQueue([track]));
    expect(await screen.findByText('Al-Mulk, evening')).toBeInTheDocument();
    const pause = screen.getByRole('button', { name: 'Pause' });
    pause.focus();
    await userEvent.keyboard('{Enter}');
    expect(usePlayer.getState().playing).toBe(false);
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('changes speed and repeat mode', async () => {
    renderWithProviders(<PlayerBar />);
    act(() => usePlayer.getState().playQueue([track]));
    await userEvent.click(await screen.findByRole('button', { name: 'Playback speed' }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: /1\.5×/ }));
    expect(usePlayer.getState().rate).toBe(1.5);
    await userEvent.click(screen.getByRole('button', { name: 'Repeat off' }));
    expect(usePlayer.getState().repeat).toBe('one');
    expect(screen.getByRole('button', { name: 'Repeat this recitation' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('opens the full-screen now playing view', async () => {
    renderWithProviders(<PlayerBar />);
    act(() => usePlayer.getState().playQueue([track]));
    const [expand] = await screen.findAllByRole('button', { name: 'Open now playing' });
    if (!expand) throw new Error('No expand button');
    await userEvent.click(expand);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Al-Mulk, evening' })).toBeInTheDocument();
  });
});
