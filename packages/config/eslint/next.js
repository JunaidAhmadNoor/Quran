// Flat ESLint config for the Next.js app. Enforces the layering rules from docs/ARCHITECTURE.md.
import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import { baseConfig } from './base.js';

/**
 * @param {{ tsconfigRootDir: string }} options
 */
export function nextConfig({ tsconfigRootDir }) {
  return [
    ...baseConfig({ tsconfigRootDir }),
    {
      plugins: { '@next/next': nextPlugin, 'react-hooks': reactHooks },
      languageOptions: { globals: { ...globals.browser, ...globals.node } },
      rules: {
        ...nextPlugin.configs.recommended.rules,
        ...nextPlugin.configs['core-web-vitals'].rules,
        ...reactHooks.configs.recommended.rules,
        // Layering rule 5: pages and handlers never reach the database directly.
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['mongoose', 'mongodb', '@tilawah/db', '@tilawah/db/*'],
                message:
                  'Only server/container.ts may import the database. Call a service from @tilawah/core instead.',
              },
            ],
          },
        ],
      },
    },
    {
      // The composition root wires repositories to services; dev scripts (seed, maintenance) share it.
      files: ['server/container.ts', 'server/auth.ts', 'scripts/**'],
      rules: { 'no-restricted-imports': 'off' },
    },
  ];
}
