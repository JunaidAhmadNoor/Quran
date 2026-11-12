// Validates apps/web/.env.local and reports which optional features are on.
// Prints variable names only, never values.
import { loadEnv } from '../server/env';

try {
  const env = loadEnv();
  const on = (enabled: boolean) => (enabled ? 'on' : 'off');
  console.warn(
    [
      'Environment OK.',
      `  Google sign-in: ${on(Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET))}`,
      `  R2 storage:     ${on(Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET))}`,
      `  Email:          ${env.EMAIL_TRANSPORT}`,
      `  Allowed origins: ${String(env.API_ALLOWED_ORIGINS.length)}`,
    ].join('\n'),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
