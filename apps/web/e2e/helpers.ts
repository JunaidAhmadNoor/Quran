import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'tilawah-demo-123';
export const accounts = {
  listener: 'listener@tilawah.dev',
  reciter: 'reciter@tilawah.dev',
  verified: 'verified@tilawah.dev',
  moderator: 'moderator@tilawah.dev',
  admin: 'admin@tilawah.dev',
} as const;

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto('/auth/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/auth\//); // the post-sign-in redirect has finished
  await expect(page.getByRole('button', { name: 'Account' })).toBeVisible();
}

export async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Account' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
}

export const unique = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** Opens the mobile menu when the desktop navigation is hidden. */
export async function openNav(page: Page) {
  const menu = page.getByRole('button', { name: 'Menu' });
  if (await menu.isVisible()) await menu.click();
}

/** Signs in through Better Auth's API (independent of the page language). */
export async function signInViaApi(page: Page, email: string, password = PASSWORD) {
  const base = new URL(page.url() === 'about:blank' ? 'http://localhost:3100' : page.url()).origin;
  const res = await page.request.post('/api/auth/sign-in/email', {
    data: { email, password },
    headers: { origin: base },
  });
  expect(res.ok()).toBe(true);
}
