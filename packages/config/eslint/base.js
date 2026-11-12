// Shared flat ESLint config for every TypeScript package.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * @param {{ tsconfigRootDir: string }} options
 */
export function baseConfig({ tsconfigRootDir }) {
  return tseslint.config(
    {
      ignores: [
        '**/dist/**',
        '**/coverage/**',
        '**/.next/**',
        '**/.turbo/**',
        '**/.data/**',
        '**/playwright-report/**',
        '**/test-results/**',
        '**/next-env.d.ts',
      ],
    },
    js.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    {
      languageOptions: {
        globals: { ...globals.node },
        parserOptions: { projectService: true, tsconfigRootDir },
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/consistent-type-imports': 'error',
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],
        '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
        // React handlers like onClick={() => setOpen(false)} return void by design.
        '@typescript-eslint/no-confusing-void-expression': [
          'error',
          { ignoreArrowShorthand: true },
        ],
        'no-console': ['error', { allow: ['warn', 'error'] }],
      },
    },
    {
      files: ['**/*.js', '**/*.mjs'],
      ...tseslint.configs.disableTypeChecked,
    },
    prettier,
  );
}

/**
 * Framework-free packages (core, contracts, recitation, quran-data, ui-tokens, api-client)
 * must stay importable from the Expo app, so Next.js and React-DOM imports are banned.
 */
export const frameworkFreeRules = {
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          { group: ['next', 'next/*'], message: 'Packages must not depend on Next.js.' },
          {
            group: ['react-dom', 'react-dom/*'],
            message: 'Packages must not depend on React DOM.',
          },
        ],
      },
    ],
  },
};
