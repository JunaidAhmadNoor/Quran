// axe on every main page: signed out and signed in, light and dark, LTR (English) and RTL (Arabic).
// One test per page so a failure names the page. Runs on Chromium (axe checks the DOM, not the engine).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { accounts, signInViaApi } from './helpers';

// Visitors can open only the landing page and the sign-in pages.
const PUBLIC = ['/', '/auth/sign-in', '/auth/sign-up'];
// Listener pages as a reciter; staff pages as an admin (staff are sent to their own area).
const SIGNED_IN = [
  '/',
  '/surahs',
  '/surahs/1',
  '/surahs/1?view=read',
  '/hadith',
  '/hadith/bukhari',
  '/hadith/bukhari/1',
  'RECITATION',
  'RECITER',
  '/library',
  '/studio',
  '/upload',
  '/settings',
];
const STAFF = ['/moderation', '/admin/users'];

async function seriousViolations(page: Page, path: string): Promise<string[]> {
  await page.goto(path);
  await page.waitForLoadState('load');
  await page.waitForTimeout(300); // hydration and entrance animations
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .options({ resultTypes: ['violations'] }) // skip detailing passing checks: much faster
    .analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map(
      (v) => `${path}: ${v.id} (${String(v.nodes.length)}) ${v.nodes[0]?.target.join(' ') ?? ''}`,
    );
}

async function resolve(page: Page, path: string): Promise<string> {
  if (path !== 'RECITATION' && path !== 'RECITER') return path;
  const res = await page.request.get('/api/v1/recitations?limit=1');
  const first = ((await res.json()) as { items: { id: string; reciter: { id: string } }[] })
    .items[0];
  if (!first) throw new Error('Seed data missing');
  return path === 'RECITATION' ? `/recitations/${first.id}` : `/reciters/${first.reciter.id}`;
}

for (const scheme of ['light', 'dark'] as const) {
  for (const locale of ['en', 'ar'] as const) {
    test.describe(`${scheme}, ${locale === 'ar' ? 'RTL' : 'LTR'}`, () => {
      test.use({ colorScheme: scheme });
      test.beforeEach(async ({ context, baseURL }) => {
        await context.addCookies([{ name: 'NEXT_LOCALE', value: locale, url: baseURL ?? '' }]);
      });

      for (const path of PUBLIC) {
        test(`${path} has no serious violations`, async ({ page }) => {
          expect(await seriousViolations(page, path)).toEqual([]);
        });
      }

      for (const path of SIGNED_IN) {
        test(`${path} (signed in) has no serious violations`, async ({ page }) => {
          await signInViaApi(page, accounts.reciter);
          expect(await seriousViolations(page, await resolve(page, path))).toEqual([]);
        });
      }

      for (const path of STAFF) {
        test(`${path} (admin) has no serious violations`, async ({ page }) => {
          await signInViaApi(page, accounts.admin);
          expect(await seriousViolations(page, path)).toEqual([]);
        });
      }
    });
  }
}
