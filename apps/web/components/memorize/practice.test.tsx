// The practice screen driven by FakeEngine: the same matcher and UI as with the real model,
// with the "heard" words scripted.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { usePlayer } from '@/lib/player-store';
import { server } from '@/test/msw';
import { renderWithProviders } from '@/test/render';
import { Practice, type PracticeAyah } from './practice';

// Al-Ikhlas 1–2.
const ayahs: PracticeAyah[] = [
  {
    number: 1,
    words: [
      { position: 1, text: 'قُلْ' },
      { position: 2, text: 'هُوَ' },
      { position: 3, text: 'ٱللَّهُ' },
      { position: 4, text: 'أَحَدٌ' },
    ],
  },
  {
    number: 2,
    words: [
      { position: 1, text: 'ٱللَّهُ' },
      { position: 2, text: 'ٱلصَّمَدُ' },
    ],
  },
];
const ALL = ['قل', 'هو', 'الله', 'احد', 'الله', 'الصمد'];

function fakeHears(script: string[]) {
  window.__TILAWAH_FAKE_ENGINE__ = { script, intervalMs: 15 };
}

// Words not yet recited: faint text (screen readers hear "Hidden word") or, in Hidden mode, a
// placeholder image with the same name.
const hidden = () => [
  ...screen.queryAllByText('Hidden word'),
  ...screen.queryAllByRole('img', { name: 'Hidden word' }),
];

function renderPractice(props: Partial<Parameters<typeof Practice>[0]> = {}) {
  return renderWithProviders(
    <Practice surah={112} ayahs={ayahs} listenUrls={{}} signedIn={false} {...props} />,
  );
}

afterEach(() => {
  delete window.__TILAWAH_FAKE_ENGINE__;
});

describe('Practice (memorization by recitation)', () => {
  it('starts hidden, offers the three modes, and reveals each word as it is heard', async () => {
    fakeHears(ALL);
    const user = userEvent.setup();
    renderPractice();
    expect(hidden()).toHaveLength(6);
    expect(screen.getByRole('radio', { name: /Reveal as I recite/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Check after each ayah/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Listen then repeat/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start reciting' }));
    expect(await screen.findByRole('heading', { name: 'Session complete' })).toBeInTheDocument();
    expect(hidden()).toHaveLength(0);
    expect(screen.getByText('100% accuracy')).toBeInTheDocument();
    expect(screen.getByText('6 of 6 words recited correctly')).toBeInTheDocument();
    expect(screen.getByText('No mistakes. Well done.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Practise these again' })).toBeNull();
  });

  it('signed out: keeps the session in this browser, as word positions only', async () => {
    fakeHears(ALL);
    const user = userEvent.setup();
    renderPractice();
    await user.click(screen.getByRole('button', { name: 'Start reciting' }));
    expect(await screen.findByText(/Saved in this browser/)).toBeInTheDocument();
    const saved = JSON.parse(localStorage.getItem('tilawah.memorization.sessions') ?? '[]') as {
      surah: number;
      ayahFrom: number;
      ayahTo: number;
      mode: string;
      wordsCorrect: number;
    }[];
    expect(saved).toEqual([
      expect.objectContaining({
        surah: 112,
        ayahFrom: 1,
        ayahTo: 2,
        mode: 'reveal',
        wordsCorrect: 6,
      }),
    ]);
  });

  it('signed in: a skipped word is revealed in the review colour and saved to the account', async () => {
    let body: unknown;
    server.use(
      http.post('*/api/v1/me/memorization/sessions', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          {
            id: '665f1c2e9b1d4a0012ab34ce',
            accuracy: 5 / 6,
            progress: {
              surah: 112,
              lastAyah: 2,
              bestAccuracy: 5 / 6,
              lastPracticedAt: '2026-11-12T08:00:00.000Z',
            },
          },
          { status: 201 },
        );
      }),
    );
    fakeHears(['قل', 'هو', 'احد', 'الله', 'الصمد']); // "ٱللَّهُ" in ayah 1 is skipped
    const user = userEvent.setup();
    renderPractice({ signedIn: true });
    await user.click(screen.getByRole('button', { name: 'Start reciting' }));
    expect(await screen.findByText('Saved to your progress.')).toBeInTheDocument();
    expect(screen.getByText('83% accuracy')).toBeInTheDocument();

    const review = screen.getByRole('region', { name: 'Words to review' });
    expect(within(review).getByText('Ayah 1')).toBeInTheDocument();
    expect(within(review).getByText('ٱللَّهُ')).toHaveClass('text-danger');
    expect(screen.getByRole('link', { name: 'Practise these again' })).toHaveAttribute(
      'href',
      '/memorize/112?from=1&to=1&mode=reveal',
    );
    // Only positions are sent: never the words that were heard.
    expect(body).toMatchObject({
      surah: 112,
      ayahFrom: 1,
      ayahTo: 2,
      mode: 'reveal',
      wordsTotal: 6,
      wordsCorrect: 5,
      mistakes: [{ ayah: 1, word: 3, type: 'missed' }],
    });
    expect(JSON.stringify(body)).not.toContain('قل');
  });

  it('check mode: an ayah stays hidden until all of it has been recited', async () => {
    fakeHears(['قل', 'هو', 'الله']); // stops before the end of ayah 1
    const user = userEvent.setup();
    renderPractice();
    await user.click(screen.getByRole('radio', { name: /Check after each ayah/ }));
    await user.click(screen.getByRole('button', { name: 'Start reciting' }));
    await waitFor(() => expect(screen.getByText('3 of 6 words')).toBeInTheDocument());
    expect(hidden()).toHaveLength(6); // three words were heard, but the ayah is not finished

    // Finishing early: everything not reached counts as missed and is shown.
    await user.click(screen.getByRole('button', { name: 'Finish' }));
    expect(await screen.findByText('50% accuracy')).toBeInTheDocument();
    expect(hidden()).toHaveLength(0);
  });

  it('reveal mode shows words as they come and counts accuracy live', async () => {
    fakeHears(['قل', 'هو']);
    const user = userEvent.setup();
    renderPractice();
    await user.click(screen.getByRole('button', { name: 'Start reciting' }));
    await waitFor(() => expect(screen.getByText('2 of 6 words')).toBeInTheDocument());
    expect(screen.getByText('100% correct so far')).toBeInTheDocument();
    expect(hidden()).toHaveLength(4);
    expect(screen.getByRole('status')).toHaveTextContent('Listening…');
  });

  it('listen mode without a recording of the ayah asks the user to recite from memory', async () => {
    fakeHears([]);
    const user = userEvent.setup();
    renderPractice();
    await user.click(screen.getByRole('radio', { name: /Listen then repeat/ }));
    await user.click(screen.getByRole('button', { name: 'Start reciting' }));
    expect(
      await screen.findByText('No recording of ayah 1 yet. Recite it from memory.'),
    ).toBeInTheDocument();
  });

  it('pauses the player first, so the microphone does not hear it', async () => {
    fakeHears([]);
    usePlayer.setState({ playing: true });
    const user = userEvent.setup();
    renderPractice();
    await user.click(screen.getByRole('button', { name: 'Start reciting' }));
    await waitFor(() => expect(usePlayer.getState().playing).toBe(false));
  });

  it('shows the text faintly by default; Hidden replaces it with placeholders, remembered', async () => {
    fakeHears([]);
    const user = userEvent.setup();
    renderPractice();
    expect(screen.getByRole('button', { name: 'Faint' })).toHaveAttribute('aria-pressed', 'true');
    // Faint: the word is laid out lightly for the eye only.
    expect(screen.getByText('قُلْ')).toHaveClass('opacity-30');
    expect(screen.getByText('قُلْ')).toHaveAttribute('aria-hidden', 'true');
    await user.click(screen.getByRole('button', { name: 'Hidden' }));
    expect(screen.getAllByRole('img', { name: 'Hidden word' })).toHaveLength(6);
    expect(screen.getByText('قُلْ')).toHaveClass('invisible');
    expect(localStorage.getItem('tilawah.memorize.text')).toBe('hidden');
  });
});
