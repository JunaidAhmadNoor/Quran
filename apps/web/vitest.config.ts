import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const alias = { '@': fileURLToPath(new URL('.', import.meta.url)) };

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        // API integration tests: real route files, in-memory MongoDB.
        resolve: { alias },
        test: {
          name: 'api',
          environment: 'node',
          include: ['test/**/*.test.ts'],
          hookTimeout: 120_000,
          testTimeout: 30_000,
        },
      },
      {
        // Component tests: React Testing Library in jsdom, API mocked with MSW.
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'components',
          environment: 'jsdom',
          include: ['components/**/*.test.tsx', 'lib/**/*.test.ts', 'messages/**/*.test.ts'],
          setupFiles: ['./test/setup-dom.ts'],
        },
      },
    ],
  },
});
