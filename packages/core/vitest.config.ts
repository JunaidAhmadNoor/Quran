import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Each test file starts its own in-memory MongoDB replica set.
    hookTimeout: 120_000,
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/testing.ts'],
      reporter: ['text-summary', 'lcov'],
      thresholds: { lines: 80 },
    },
  },
});
