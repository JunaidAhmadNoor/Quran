import { describe, expect, it } from 'vitest';
import { loadEnv } from '../server/env';

const secret = 'x'.repeat(32);
const base = {
  NODE_ENV: 'production',
  NEXT_PUBLIC_APP_URL: 'https://tilawah.example',
  BETTER_AUTH_URL: 'https://tilawah.example',
  API_ALLOWED_ORIGINS: 'https://tilawah.example',
  MONGODB_URI: 'mongodb://db',
  BETTER_AUTH_SECRET: secret,
  UPLOAD_TICKET_SECRET: secret,
  IP_HASH_SECRET: secret,
  R2_ACCOUNT_ID: 'a',
  R2_ACCESS_KEY_ID: 'b',
  R2_SECRET_ACCESS_KEY: 'c',
  R2_BUCKET: 'd',
  EMAIL_TRANSPORT: 'brevo',
  BREVO_API_KEY: 'k',
  EMAIL_FROM: 'Tilawah <no-reply@tilawah.example>',
};

describe('production environment', () => {
  it('accepts a complete configuration', () => {
    expect(loadEnv(base).EMAIL_TRANSPORT).toBe('brevo');
  });

  it('needs email and HTTPS when live, and never prints values', () => {
    expect(() => loadEnv({ ...base, EMAIL_TRANSPORT: 'none' })).toThrow(/EMAIL_TRANSPORT/);
    expect(() => loadEnv({ ...base, BETTER_AUTH_URL: 'http://tilawah.example' })).toThrow(/HTTPS/);
    expect(() => loadEnv({ ...base, BREVO_API_KEY: '' })).not.toThrow(/k\b/);
  });

  it('allows the local end-to-end stack (disk storage, no email, http)', () => {
    expect(() =>
      loadEnv({
        ...base,
        STORAGE_DRIVER: 'local',
        EMAIL_TRANSPORT: 'none',
        BETTER_AUTH_URL: 'http://localhost:3100',
      }),
    ).not.toThrow();
  });
});
