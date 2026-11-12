import { z } from 'zod';

/** Blank values in .env files mean "not set". */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

const secret = z.string().min(32, 'Generate with: openssl rand -base64 32');

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    NEXT_PUBLIC_APP_URL: z.url(),
    API_ALLOWED_ORIGINS: z.string().transform((s) =>
      s
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    ),
    MONGODB_URI: z.string().min(1),
    BETTER_AUTH_SECRET: secret,
    BETTER_AUTH_URL: z.url(),
    GOOGLE_CLIENT_ID: optional(z.string()),
    GOOGLE_CLIENT_SECRET: optional(z.string()),
    R2_ACCOUNT_ID: optional(z.string()),
    R2_ACCESS_KEY_ID: optional(z.string()),
    R2_SECRET_ACCESS_KEY: optional(z.string()),
    R2_BUCKET: optional(z.string()),
    R2_PUBLIC_BASE_URL: optional(z.url()),
    UPLOAD_TICKET_SECRET: secret,
    IP_HASH_SECRET: secret,
    EMAIL_TRANSPORT: z.enum(['brevo', 'none']).default('none'),
    EMAIL_FROM: optional(z.string()),
    BREVO_API_KEY: optional(z.string()),
  })
  .superRefine((env, ctx) => {
    const r2 = [env.R2_ACCOUNT_ID, env.R2_ACCESS_KEY_ID, env.R2_SECRET_ACCESS_KEY, env.R2_BUCKET];
    if (env.NODE_ENV === 'production' && r2.some((v) => v === undefined)) {
      ctx.addIssue({
        code: 'custom',
        message: 'All R2_* variables are required in production',
        path: ['R2_BUCKET'],
      });
    }
    if (env.EMAIL_TRANSPORT === 'brevo' && (!env.BREVO_API_KEY || !env.EMAIL_FROM)) {
      ctx.addIssue({
        code: 'custom',
        message: 'brevo needs BREVO_API_KEY and EMAIL_FROM',
        path: ['BREVO_API_KEY'],
      });
    }
  });

export type Env = z.output<typeof EnvSchema>;

/** Validates process.env once. Error messages name the variable but never print its value. */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return parsed.data;
}
