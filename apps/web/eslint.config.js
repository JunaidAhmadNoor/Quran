import { nextConfig } from '@tilawah/config/eslint/next';

export default [
  // Copied third-party binaries (scripts/copy-ort.mjs) and model files are not our code.
  { ignores: ['public/ort/**', 'public/models/**'] },
  ...nextConfig({ tsconfigRootDir: import.meta.dirname }),
  {
    // Runs in the AudioWorkletGlobalScope, not the window.
    files: ['public/worklets/**/*.js'],
    languageOptions: {
      globals: {
        AudioWorkletProcessor: 'readonly',
        registerProcessor: 'readonly',
        sampleRate: 'readonly',
      },
    },
  },
];
