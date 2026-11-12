import { baseConfig, frameworkFreeRules } from '@tilawah/config/eslint/base';

export default [...baseConfig({ tsconfigRootDir: import.meta.dirname }), frameworkFreeRules];
