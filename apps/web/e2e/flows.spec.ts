import { expect, test } from '@playwright/test';
import { accounts, signIn, signOut, unique } from './helpers';

const FIXTURE = new URL('./fixtures/sample-recitation.mp3', import.meta.url).pathname;

test('sign up → switch to reciter → upload → moderator approves → appears on the surah page → another user plays and likes', async ({
  page,
  isMobile,
}) => {
  const title = unique('Ikhlas e2e');

  // A new account starts as a listener and switches to reciter mode without signing out.
  await page.goto('/auth/sign-up');
  await page.getByLabel('Name').fill('E2E Reciter');
  await page.getByLabel('Email').fill(`${unique('reciter')}@example.com`);
  await page.getByLabel('Password').fill('a strong password');
  await page.getByRole('button', { name: 'Create your account' }).click();
  await expect(page).not.toHaveURL(/\/auth\//);
  await expect(page.getByRole('button', { name: 'Account' })).toBeVisible();

  if (isMobile) await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('radio', { name: 'Reciter' }).filter({ visible: true }).first().click();
  await page.getByRole('button', { name: 'Turn on reciter mode' }).click();
  await expect(page).toHaveURL(/\/studio$/);
  await expect(page.getByRole('heading', { name: 'Reciter studio' })).toBeVisible();

  // Upload the real MP3 through the presigned URL.
  await page.goto('/upload');
  await page.getByLabel('Surah').selectOption('112');
  await page.getByLabel('To ayah').fill('4');
  await page.getByLabel('Title').fill(title);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.locator('#audio-file').setInputFiles(FIXTURE);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel(/my own recitation/).check();
  await page.getByRole('button', { name: 'Upload' }).click();
  await expect(page.getByText('Uploaded. Waiting for review.')).toBeVisible();

  // Not public yet.
  await page.goto('/surahs/112');
  await expect(page.getByRole('link', { name: title })).toHaveCount(0);
  await signOut(page);

  // A moderator approves it.
  await signIn(page, accounts.moderator);
  await page.goto('/moderation');
  const item = page.getByRole('listitem').filter({ hasText: title });
  await item.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('Approved', { exact: true })).toBeVisible();
  await signOut(page);

  // Another user finds it on the surah page, plays it and likes it.
  await signIn(page, accounts.listener);
  await page.goto('/surahs/112');
  const row = page.getByRole('listitem').filter({ hasText: title });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: `Play: ${title}` }).click();
  const player = page.getByRole('region', { name: 'Audio player' });
  await expect(player.getByText(title)).toBeVisible();
  await expect(player.getByRole('button', { name: 'Pause' })).toBeVisible();
  await row.getByRole('button', { name: 'Like' }).click();
  await expect(row.getByRole('button', { name: 'Remove like' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('the player keeps playing while navigating between pages', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Seek slider is hidden on phones; covered on desktop projects');
  await page.goto('/surahs/113');
  await page.getByRole('button', { name: /^Play: Al-Falaq/ }).click();
  const player = page.getByRole('region', { name: 'Audio player' });
  const seek = player.getByRole('slider', { name: 'Seek' });
  await expect
    .poll(async () => Number(await seek.getAttribute('aria-valuenow')), { timeout: 8_000 })
    .toBeGreaterThanOrEqual(1);
  const before = Number(await seek.getAttribute('aria-valuenow'));

  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Surahs' })
    .click();
  await expect(page.getByRole('heading', { name: 'Surahs', level: 1 })).toBeVisible();
  await expect(player.getByRole('button', { name: 'Pause' })).toBeVisible();
  await expect
    .poll(async () => Number(await seek.getAttribute('aria-valuenow')), { timeout: 8_000 })
    .toBeGreaterThan(before);
});

test('switching to Arabic lays the site out right-to-left without horizontal scrolling', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Language' }).click();
  await page.getByRole('menuitemradio', { name: 'العربية' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  for (const path of ['/', '/surahs', '/surahs/2', '/memorize']) {
    await page.goto(path);
    const overflow = await page.evaluate(() => {
      let worst = 0;
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0) worst = Math.max(worst, -r.left, r.right - window.innerWidth);
      }
      return Math.round(worst);
    });
    expect(overflow, `${path} overflows by ${String(overflow)}px`).toBeLessThanOrEqual(1);
  }
});

test('is usable with the keyboard: skip link and focusable controls', async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName === 'webkit',
    'WebKit only tabs to links with the "Press Tab to highlight each item" setting',
  );
  await page.goto('/surahs/112');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
  const play = page.getByRole('button', { name: /^Play: Al-Ikhlas/ });
  await play.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('region', { name: 'Audio player' }).getByRole('button', { name: 'Pause' }),
  ).toBeVisible();
});

test('switching language does not interrupt playback', async ({ page }) => {
  await page.goto('/surahs/114');
  await page.getByRole('button', { name: /^Play: An-Nas/ }).click();
  const player = page.getByRole('region', { name: 'Audio player' });
  await expect(player.getByRole('button', { name: 'Pause' })).toBeVisible();

  await page.getByRole('button', { name: 'Language' }).click();
  await page.getByRole('menuitemradio', { name: 'العربية' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  // Same player, now labelled in Arabic, still playing.
  await expect(
    page.getByRole('region', { name: 'مشغّل الصوت' }).getByRole('button', { name: 'إيقاف مؤقت' }),
  ).toBeVisible();
});

test('a reciter records in the browser and uploads the recording', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Only Chromium provides a fake microphone for automation');
  const title = unique('Recorded e2e');
  await signIn(page, accounts.reciter);
  await page.goto('/upload');
  await page.getByLabel('Surah').selectOption('112');
  await page.getByLabel('To ayah').fill('4');
  await page.getByLabel('Title').fill(title);
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByRole('radio', { name: 'Record now' }).click();
  await page.getByRole('button', { name: 'Start recording' }).click();
  await expect(page.getByText('Recording', { exact: true })).toBeVisible();
  await expect(page.getByRole('timer')).toHaveText(/0:0[4-9]/, { timeout: 10_000 });
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.getByText(/Recording ready \(0:0[4-9]\)/)).toBeVisible();
  await expect(page.getByLabel('Listen to your recording')).toBeVisible();
  await page.getByRole('button', { name: 'Use this recording' }).click();

  await page.getByLabel(/my own recitation/).check();
  await page.getByRole('button', { name: 'Upload' }).click();
  await expect(page.getByText('Uploaded. Waiting for review.')).toBeVisible();

  const mine = await page.request.get('/api/v1/me/recitations');
  const items = (
    (await mine.json()) as {
      items: {
        title: string;
        status: string;
        durationSec: number;
        stream: { contentType: string };
      }[];
    }
  ).items;
  const uploaded = items.find((r) => r.title === title);
  expect(uploaded).toMatchObject({ status: 'pending', stream: { contentType: 'audio/webm' } });
  expect(uploaded?.durationSec).toBeGreaterThanOrEqual(4);
});
