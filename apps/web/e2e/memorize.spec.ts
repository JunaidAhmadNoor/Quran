// Memorization end to end with the scripted FakeEngine (window.__TILAWAH_FAKE_ENGINE__): the real
// page, matcher, API and database, without a microphone or the model download.
import { expect, test, type Page } from '@playwright/test';
import { accounts, signInViaApi } from './helpers';

// Al-Ikhlas as a recognizer would write it (no diacritics). "كفوا" (ayah 4, word 4) is skipped.
const IKHLAS = ['قل', 'هو', 'الله', 'احد', 'الله', 'الصمد', 'لم', 'يلد', 'ولم', 'يولد'];
const WITH_SKIP = [...IKHLAS, 'ولم', 'يكن', 'له', 'احد'];

async function fakeRecognizer(page: Page, script: string[]) {
  await page.addInitScript((words) => {
    window.__TILAWAH_FAKE_ENGINE__ = { script: words, intervalMs: 120 };
  }, script);
}

test('signed in: recite a range, see the summary, and the progress is saved', async ({ page }) => {
  await signInViaApi(page, accounts.listener);
  await fakeRecognizer(page, WITH_SKIP);
  await page.goto('/memorize/112?from=1&to=4');

  await expect(page.getByText('Hidden word')).toHaveCount(15); // faint text by default
  await page.getByRole('button', { name: 'Start reciting' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Listening…' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible();

  await expect(page.getByText('93% accuracy')).toBeVisible(); // 14 of 15
  await expect(page.getByText('Saved to your progress.')).toBeVisible();
  const review = page.getByRole('region', { name: 'Words to review' });
  await expect(review.getByText('Ayah 4')).toBeVisible();
  await expect(page.getByText('Hidden word')).toHaveCount(0);

  const res = await page.request.get('/api/v1/me/memorization/progress');
  const { items } = (await res.json()) as { items: { surah: number; lastAyah: number }[] };
  expect(items).toContainEqual(expect.objectContaining({ surah: 112, lastAyah: 4 }));

  // "Practise these again" opens just the ayah with the mistake, in the same mode.
  await page.getByRole('link', { name: 'Practise these again' }).click();
  await expect(page).toHaveURL(/\/memorize\/112\?from=4&to=4&mode=reveal$/);
  await expect(page.getByText('Hidden word')).toHaveCount(5);
});

test('check mode: the session is saved to progress', async ({ page }) => {
  await signInViaApi(page, accounts.reciter);
  await fakeRecognizer(page, IKHLAS);
  await page.goto('/memorize/112?from=1&to=3');
  await page.getByRole('radio', { name: /Check after each ayah/ }).check();
  await page.getByRole('button', { name: 'Start reciting' }).click();
  await expect(page.getByText('100% accuracy')).toBeVisible();
  await expect(page.getByText('Saved to your progress.')).toBeVisible();
});
