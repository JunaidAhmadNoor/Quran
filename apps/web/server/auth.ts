// Better Auth: email + password and Google, cookie sessions for the web and Bearer tokens for
// the mobile app. Owns the users, sessions, accounts and verifications collections.
import type { Core } from '@tilawah/core';
import type { Database } from '@tilawah/db';
import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { bearer } from 'better-auth/plugins';
import { resetPasswordEmail, verificationEmail, type EmailPort } from './email';
import type { Env } from './env';

export interface AuthDeps {
  database: Database;
  env: Env;
  email: EmailPort;
  core: Core;
}

export function createAuth({ database, env, email, core }: AuthDeps) {
  const google =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
      : {};

  return betterAuth({
    appName: 'Tilawah',
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: mongodbAdapter(database.db, { client: database.client }),
    trustedOrigins: env.API_ALLOWED_ORIGINS,
    user: {
      modelName: 'users',
      // Names and defaults must match packages/db/src/models/users.ts. None are user-settable.
      additionalFields: {
        role: { type: 'string', defaultValue: 'user', input: false },
        mode: { type: 'string', defaultValue: 'listener', input: false },
        reciterSince: { type: 'date', required: false, input: false },
        verifiedReciter: { type: 'boolean', defaultValue: false, input: false },
        bio: { type: 'string', required: false, input: false },
        country: { type: 'string', required: false, input: false },
      },
    },
    // No cookie cache: mode and role changes must apply on the very next request.
    session: { modelName: 'sessions', cookieCache: { enabled: false } },
    account: { modelName: 'accounts' },
    verification: { modelName: 'verifications' },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await email.send({ to: user.email, ...resetPasswordEmail(url) });
      },
    },
    emailVerification: {
      sendOnSignUp: env.EMAIL_TRANSPORT !== 'none',
      sendVerificationEmail: async ({ user, url }) => {
        await email.send({ to: user.email, ...verificationEmail(url) });
      },
    },
    socialProviders: google,
    databaseHooks: {
      // Collect only what the data model lists: no IP address or user agent on sessions.
      session: {
        create: {
          before: (session) =>
            Promise.resolve({ data: { ...session, ipAddress: null, userAgent: null } }),
        },
      },
    },
    rateLimit: {
      enabled: true,
      customStorage: {
        // Better Auth keys contain the client IP; store only a keyed hash of them.
        consume: async (key, rule) => {
          const result = await core.rateLimiter.hit(
            `auth:${core.hashIp(key, env.IP_HASH_SECRET)}`,
            rule.window,
            rule.max,
          );
          return {
            allowed: result.allowed,
            retryAfter: result.allowed ? null : result.retryAfterSec,
          };
        },
      },
    },
    advanced: {
      cookiePrefix: 'tilawah',
      useSecureCookies: env.NODE_ENV === 'production',
      ipAddress: { ipAddressHeaders: ['x-real-ip', 'x-forwarded-for'] },
    },
    plugins: [bearer()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
