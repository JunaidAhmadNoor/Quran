import { baseConfig, frameworkFreeRules } from '@tilawah/config/eslint/base';

export default [
  { ignores: ['generated/**'] },
  ...baseConfig({ tsconfigRootDir: import.meta.dirname }),
  frameworkFreeRules,
];
