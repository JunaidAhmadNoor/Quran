import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickFormat } from '@/lib/recorder';
import { installFakeMedia, stopTrack, uninstallFakeMedia } from '@/test/fake-media';
import { renderWithProviders } from '@/test/render';
import { Recorder } from './recorder';

afterEach(() => {
  vi.useRealTimers();
  uninstallFakeMedia();
  stopTrack.mockClear();
});

const setup = () => userEvent.setup();

describe('pickFormat', () => {
  it('prefers WebM/Opus, falls back to MP4 (Safari) and Ogg, and maps to API types', () => {
    expect(pickFormat(() => true)).toMatchObject({ uploadType: 'audio/webm', extension: 'webm' });
    expect(pickFormat((t) => t === 'audio/mp4')).toMatchObject({
      uploadType: 'audio/mp4',
      extension: 'm4a',
    });
    expect(pickFormat((t) => t.startsWith('audio/ogg'))).toMatchObject({ uploadType: 'audio/ogg' });
    expect(pickFormat(() => false)).toBeNull();
  });
});

describe('Recorder', () => {
  it('records, pauses without counting the pause, stops, releases the microphone and hands over the file', async () => {
    // Only the recorder's clock is faked; setTimeout stays real for Testing Library's polling.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    installFakeMedia();
    const onUse = vi.fn();
    renderWithProviders(<Recorder onUse={onUse} onChooseFile={vi.fn()} />);
    const user = setup();

    await user.click(screen.getByRole('button', { name: 'Start recording' }));
    expect(await screen.findByText('Recording')).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(4000));
    expect(screen.getByRole('timer')).toHaveTextContent('0:04');

    await user.click(screen.getByRole('button', { name: 'Pause' }));
    await act(() => vi.advanceTimersByTimeAsync(10_000)); // paused time is not recorded
    await user.click(screen.getByRole('button', { name: 'Resume' }));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    await user.click(screen.getByRole('button', { name: 'Stop' }));

    expect(stopTrack).toHaveBeenCalled(); // microphone indicator turns off
    expect(screen.getByText(/Recording ready \(0:05\)/)).toBeInTheDocument();
    expect(screen.getByLabelText('Listen to your recording')).toHaveAttribute(
      'src',
      'blob:recording',
    );
    await user.click(screen.getByRole('button', { name: 'Use this recording' }));
    const [file, duration] = onUse.mock.calls[0] as [File, number];
    expect(file.type).toBe('audio/webm'); // codecs parameter stripped for the API
    expect(file.name).toMatch(/^recording-.*\.webm$/);
    expect(duration).toBe(5);
  });

  it('refuses recordings shorter than 3 seconds', async () => {
    // Only the recorder's clock is faked; setTimeout stays real for Testing Library's polling.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    installFakeMedia();
    renderWithProviders(<Recorder onUse={vi.fn()} onChooseFile={vi.fn()} />);
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Start recording' }));
    await act(() => vi.advanceTimersByTimeAsync(1500));
    await user.click(await screen.findByRole('button', { name: 'Stop' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Record at least 3 seconds.');
    expect(screen.getByRole('button', { name: 'Use this recording' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Record again' }));
    expect(screen.getByRole('button', { name: 'Start recording' })).toBeInTheDocument();
  });

  it('explains a blocked microphone and offers the file picker', async () => {
    installFakeMedia({ deny: true });
    const onChooseFile = vi.fn();
    renderWithProviders(<Recorder onUse={vi.fn()} onChooseFile={onChooseFile} />);
    await userEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Microphone access was blocked');
    await userEvent.click(screen.getByRole('button', { name: 'Choose a file' }));
    expect(onChooseFile).toHaveBeenCalled();
  });

  it('says when the browser cannot record', async () => {
    renderWithProviders(<Recorder onUse={vi.fn()} onChooseFile={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This browser cannot record audio');
  });
});
