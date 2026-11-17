// Generates docs/screenshots/*.png. Run on demand: SCREENSHOTS=1 pnpm exec playwright test screenshots --project=chromium
import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { accounts, signInViaApi } from './helpers';

const OUT = new URL('../../../docs/screenshots/', import.meta.url).pathname;
test.skip(!process.env.SCREENSHOTS, 'Set SCREENSHOTS=1 to regenerate docs/screenshots');
test.describe.configure({ mode: 'serial' });

async function shot(page: Page, name: string, scheme: string) {
  await page.waitForLoadState('load');
  await page.waitForTimeout(800); // let fonts and entrance animations settle
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: `${OUT}${name}-${scheme}.png`, fullPage: true });
}

for (const scheme of ['light', 'dark'] as const) {
  test(`public pages (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 1280, height: 900 });
    await signInViaApi(page, accounts.listener); // the API needs an account
    const first = (
      (await (await page.request.get('/api/v1/recitations?limit=1&sort=popular')).json()) as {
        items: { id: string; reciter: { id: string } }[];
      }
    ).items[0];
    expect(first).toBeDefined();
    const pages: [string, string][] = [
      ['home', '/'],
      ['surahs', '/surahs'],
      ['surah', '/surahs/1'],
      ['recitation', `/recitations/${first?.id ?? ''}`],
      ['reciter', `/reciters/${first?.reciter.id ?? ''}`],
      ['sign-in', '/auth/sign-in'],
      ['sign-up', '/auth/sign-up'],
      ['reset-password', '/auth/reset-password'],
      ['privacy', '/privacy'],
      ['not-found', '/surahs/999'],
      ['hadith', '/hadith'],
      ['hadith-book', '/hadith/bukhari'],
      ['hadith-section', '/hadith/bukhari/1'],
    ];
    await page.context().clearCookies();
    // The landing and sign-in pages as a visitor; the rest needs an account.
    for (const [name, path] of pages.filter(([n]) =>
      ['home', 'sign-in', 'sign-up', 'reset-password', 'privacy'].includes(n),
    )) {
      await page.goto(path);
      await shot(page, name === 'home' ? 'landing' : name, scheme);
    }
    await signInViaApi(page, accounts.listener);
    for (const [name, path] of pages.filter(
      ([n]) => !['sign-in', 'sign-up', 'reset-password', 'privacy'].includes(n),
    )) {
      await page.goto(path);
      await shot(page, name, scheme);
    }
    await page.goto('/surahs/1?view=read');
    await shot(page, 'surah-read', scheme);
  });

  test(`signed-in pages (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await signInViaApi(page, accounts.verified);
    const list = (
      (await (await page.request.get('/api/v1/recitations?limit=3')).json()) as {
        items: { id: string }[];
      }
    ).items;
    for (const r of list.slice(0, 2))
      await page.request.post(`/api/v1/recitations/${r.id}/like`, {
        headers: { origin: new URL(page.url()).origin },
      });
    for (const [name, path] of [
      ['library', '/library'],
      ['studio', '/studio'],
      ['upload', '/upload'],
      ['settings', '/settings'],
    ] as const) {
      await page.goto(path);
      await shot(page, name, scheme);
    }
    // In-browser recording (Chromium's fake microphone).
    await page.goto('/upload');
    await page.getByLabel('Title').fill('Al-Ikhlas, recorded');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('radio', { name: 'Record now' }).click();
    await page.getByRole('button', { name: 'Start recording' }).click();
    await expect(page.getByRole('timer')).toHaveText(/0:0[3-9]/, { timeout: 10_000 });
    await shot(page, 'upload-recording', scheme);
    await page.getByRole('button', { name: 'Stop' }).click();
    await expect(page.getByText(/Recording ready/)).toBeVisible();
    await shot(page, 'upload-recorded', scheme);

    // Player bar and the full-screen view.
    await page.goto('/surahs/112');
    await page.getByRole('button', { name: /^Play: Al-Ikhlas/ }).click();
    await page.waitForTimeout(1500);
    await shot(page, 'player-bar', scheme);
    await page.getByRole('button', { name: 'Open now playing' }).first().click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}now-playing-${scheme}.png` });
  });

  test(`moderation (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await signInViaApi(page, accounts.moderator);
    await page.goto('/moderation');
    await shot(page, 'moderation', scheme);
  });

  test(`admin (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await signInViaApi(page, accounts.admin);
    await page.goto('/admin/users');
    await shot(page, 'admin-users', scheme);
  });

  test(`Arabic, phone width (${scheme})`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'NEXT_LOCALE', value: 'ar', url: baseURL ?? '' }]);
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 375, height: 812 });
    for (const [name, path] of [
      ['mobile-ar-home', '/'],
      ['mobile-ar-surah', '/surahs/36'],
      ['mobile-ar-surahs', '/surahs'],
    ] as const) {
      await page.goto(path);
      await shot(page, name, scheme);
    }
    await page.goto('/surahs/36?view=read');
    await shot(page, 'mobile-ar-read', scheme);
  });
}
