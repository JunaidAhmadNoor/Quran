// The real speech pipeline in Chromium: microphone (a WAV file as the fake capture device) →
// AudioWorklet → Whisper in a Web Worker → matcher → revealed words. Opt-in, because it loads the
// ~105 MB model: E2E_SPEECH_WAV=/path/to/ikhlas.wav pnpm e2e --project=chromium speech-model
import { expect, test } from '@playwright/test';

const wav = process.env.E2E_SPEECH_WAV;

test.skip(!wav, 'Set E2E_SPEECH_WAV to a recitation of Al-Ikhlas (16-bit PCM WAV)');
test.use({
  launchOptions: {
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      `--use-file-for-fake-audio-capture=${wav ?? ''}`,
    ],
  },
  permissions: ['microphone'],
});

test('recognizes Al-Ikhlas from the microphone and reveals the words', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Fake audio capture from a file is Chromium-only');
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/memorize/112');
  await page.getByRole('button', { name: 'Start reciting' }).click();
  await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible({
    timeout: 200_000,
  });
  const accuracy = await page.getByText(/% accuracy$/).textContent();
  test.info().annotations.push({ type: 'accuracy', description: accuracy ?? '?' });
  expect(Number(accuracy?.replace(/\D/g, ''))).toBeGreaterThanOrEqual(80);
  expect(errors.filter((e) => /Content Security Policy|Refused/.test(e))).toEqual([]);
});
