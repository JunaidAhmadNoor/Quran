import { nextConfig } from '@tilawah/config/eslint/next';

export default [...nextConfig({ tsconfigRootDir: import.meta.dirname })];
