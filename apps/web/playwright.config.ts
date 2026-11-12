import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.E2E_PORT ?? '3100';

/**
 * Runs against the production build with an isolated stack (e2e/server.ts): in-memory MongoDB,
 * local-disk storage, seeded demo accounts and a real MP3. Build first: pnpm build.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['github']]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // A fake microphone (a steady tone) so the in-browser recorder can be tested.
        launchOptions: {
          args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
        },
        permissions: ['microphone'],
      },
    },
    // axe results depend on the DOM, not the engine; it runs on Chromium (it can hang in WebKit).
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testIgnore: /accessibility|screenshots/,
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], viewport: { width: 375, height: 812 } },
      testIgnore: /accessibility|screenshots/,
    },
  ],
  webServer: {
    command: 'pnpm e2e:server',
    url: `http://localhost:${PORT}/api/v1/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
