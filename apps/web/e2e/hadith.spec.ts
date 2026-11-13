// Hadith: browse a collection, read a book in Arabic with translations, search, open one hadith.
import { expect, test } from '@playwright/test';
import { accounts, signInViaApi } from './helpers';

test.beforeEach(async ({ page }) => {
  await signInViaApi(page, accounts.listener);
});

test('browse Sahih al-Bukhari, switch translations, search and open a hadith', async ({ page }) => {
  await page.goto('/hadith');
  await page.getByRole('link', { name: /Sahih al-Bukhari/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sahih al-Bukhari' })).toBeVisible();
  await page.getByRole('link', { name: /Revelation/ }).click();

  const first = page.getByRole('article', { name: 'Hadith 1' });
  await expect(first.getByText(/intentions/)).toBeVisible(); // English shown by default
  await expect(first.locator('[lang="ar"]')).toBeVisible();
  await page.getByRole('button', { name: 'Urdu' }).click();
  await expect(first.locator('[lang="ur"]')).toBeVisible();
  await page.getByRole('button', { name: 'English' }).click();
  await expect(first.getByText(/intentions/)).toBeHidden();
  await page.getByRole('button', { name: 'English' }).click(); // restore for other tests

  await page.goto('/hadith/bukhari');
  await page
    .getByRole('searchbox', { name: 'Search this collection' })
    .fill('انما الاعمال بالنيات');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('heading', { name: /results? for/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Books' })).toBeHidden(); // results replace the list
  const result = page.getByRole('listitem').filter({ hasText: 'Hadith 1' }).first();
  await expect(result.locator('mark').first()).toBeVisible(); // matched words highlighted
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(page.getByRole('heading', { name: 'Books' })).toBeVisible();
  await page
    .getByRole('searchbox', { name: 'Search this collection' })
    .fill('انما الاعمال بالنيات');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('link', { name: 'Hadith 1', exact: true }).first().click();
  await expect(page).toHaveURL(/\/hadith\/bukhari\/n\/1$/);
  await expect(page.getByRole('complementary', { name: 'Sources' })).toContainText('Muhsin Khan');
});

test('Sahih Muslim opens at its introduction, and unknown pages are not found', async ({
  page,
}) => {
  await page.goto('/hadith/muslim');
  await expect(page.getByRole('link', { name: /Introduction/ })).toBeVisible();
  await page.goto('/hadith/tirmidhi');
  await expect(page.getByRole('heading', { name: 'This page could not be found' })).toBeVisible();
});
