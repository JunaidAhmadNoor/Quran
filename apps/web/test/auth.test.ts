// Real Better Auth against the in-memory database: proves the same endpoints work with the web
// session cookie and with the mobile Bearer token, and that sessions store no IP address.
import { setContainer, type AppContainer } from '@/server/container';
import { createAuth } from '@/server/auth';
import { ConsoleEmail, type EmailMessage, type EmailPort } from '@/server/email';
import { loadEnv } from '@/server/env';
import { startTestCore, type TestCore } from '@tilawah/core/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ORIGIN, call } from './harness';

let t: TestCore;
let auth: ReturnType<typeof createAuth>;

beforeAll(async () => {
  t = await startTestCore();
  const env = loadEnv({
    NODE_ENV: 'test',
    NEXT_PUBLIC_APP_URL: ORIGIN,
    API_ALLOWED_ORIGINS: ORIGIN,
    MONGODB_URI: t.db.uri,
    BETTER_AUTH_SECRET: 'test-better-auth-secret-0123456789abcdef',
    BETTER_AUTH_URL: ORIGIN,
    UPLOAD_TICKET_SECRET: 'test-upload-secret-0123456789abcdef0123',
    IP_HASH_SECRET: 'test-ip-hash-secret-0123456789abcdef0123',
  });
  auth = createAuth({ database: t.db.database, env, email: new ConsoleEmail(false), core: t.core });
  const container: AppContainer = {
    core: t.core,
    auth,
    database: t.db.database,
    storage: t.storage,
    googleEnabled: false,
    config: {
      allowedOrigins: [ORIGIN],
      ipHashSecret: env.IP_HASH_SECRET,
      apiVersion: '1.0.0',
      production: false,
    },
    async resolveSession(headers) {
      const result = await auth.api.getSession({ headers });
      return result
        ? { userId: result.session.userId, sessionCreatedAt: new Date(result.session.createdAt) }
        : null;
    },
  };
  setContainer(container);
});
afterAll(() => t.stop());

async function signUp(email: string) {
  const response = await auth.handler(
    new Request(`${ORIGIN}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ name: 'Amina', email, password: 'correct horse battery' }),
    }),
  );
  expect(response.status).toBe(200);
  return {
    token: response.headers.get('set-auth-token'),
    cookie: response.headers.get('set-cookie')?.split(';')[0] ?? '',
  };
}

describe('Better Auth integration', () => {
  it('creates users with Tilawah defaults and protected fields', async () => {
    await signUp('amina@example.com');
    const user = await t.core.users.findByEmail('amina@example.com');
    expect(user).toMatchObject({ role: 'user', mode: 'listener', verifiedReciter: false });
  });

  it('accepts the mobile Bearer token on /api/v1', async () => {
    const { token } = await signUp('mobile@example.com');
    expect(token).toBeTruthy();
    const me = await call('getMe', { headers: { authorization: `Bearer ${token ?? ''}` } });
    expect(me.status).toBe(200);
    expect(me.json.email).toBe('mobile@example.com');
  });

  it('accepts the web session cookie, and switching mode needs no new session', async () => {
    const { cookie } = await signUp('web@example.com');
    expect(cookie).toMatch(/^tilawah\.session_token=/);
    const headers = { cookie, origin: ORIGIN };
    expect((await call('switchMode', { headers, body: { mode: 'reciter' } })).status).toBe(200);
    expect((await call('getMe', { headers })).json.mode).toBe('reciter');
  });

  it('stores no IP address or user agent on sessions', async () => {
    const sessions = await t.db.database.db.collection('sessions').find().toArray();
    expect(sessions.length).toBeGreaterThan(0);
    for (const s of sessions) {
      expect(s.ipAddress ?? null).toBeNull();
      expect(s.userAgent ?? null).toBeNull();
    }
  });

  it('does not let sign-up set the role', async () => {
    await auth.handler(
      new Request(`${ORIGIN}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: ORIGIN },
        body: JSON.stringify({
          name: 'X',
          email: 'sneaky@example.com',
          password: 'correct horse battery',
          role: 'admin',
        }),
      }),
    );
    const user = await t.core.users.findByEmail('sneaky@example.com');
    expect(user?.role ?? 'user').toBe('user');
  });
});

describe('email verification (when email is configured)', () => {
  const sent: EmailMessage[] = [];
  let strict: ReturnType<typeof createAuth>;

  beforeAll(() => {
    const env = loadEnv({
      NODE_ENV: 'test',
      NEXT_PUBLIC_APP_URL: ORIGIN,
      API_ALLOWED_ORIGINS: ORIGIN,
      MONGODB_URI: t.db.uri,
      BETTER_AUTH_SECRET: 'test-better-auth-secret-0123456789abcdef',
      BETTER_AUTH_URL: ORIGIN,
      UPLOAD_TICKET_SECRET: 'test-upload-secret-0123456789abcdef0123',
      IP_HASH_SECRET: 'test-ip-hash-secret-0123456789abcdef0123',
      EMAIL_TRANSPORT: 'brevo',
      BREVO_API_KEY: 'test-key',
      EMAIL_FROM: 'Tilawah <test@example.com>',
      AUTH_RATE_LIMIT: 'off', // many sign-ins from one test address
    });
    const email: EmailPort = {
      send: (m) => {
        sent.push(m);
        return Promise.resolve();
      },
    };
    strict = createAuth({ database: t.db.database, env, email, core: t.core });
  });

  const post = (path: string, body: object) =>
    strict.handler(
      new Request(`${ORIGIN}/api/auth/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: ORIGIN },
        body: JSON.stringify(body),
      }),
    );
  const signInAs = (email: string) =>
    post('sign-in/email', { email, password: 'correct horse battery' });

  it('sign-up sends the verification email and does not sign in', async () => {
    const res = await post('sign-up/email', {
      name: 'Bilal',
      email: 'bilal@example.com',
      password: 'correct horse battery',
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('set-auth-token')).toBeNull();
    expect(sent.map((m) => m.to)).toContain('bilal@example.com');
  });

  it('refuses sign-in for an unverified user with EMAIL_NOT_VERIFIED', async () => {
    const res = await signInAs('bilal@example.com');
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('the verification link verifies the email and signs the user in', async () => {
    const link = /https?:\/\/\S+verify-email\S+/.exec(sent.at(-1)?.text ?? '')?.[0];
    expect(link).toBeDefined();
    const res = await strict.handler(new Request(link ?? '', { headers: { origin: ORIGIN } }));
    expect([200, 302]).toContain(res.status);
    expect(res.headers.get('set-cookie')).toContain('session_token');
    expect((await t.core.users.findByEmail('bilal@example.com'))?.emailVerified).toBe(true);
    expect((await signInAs('bilal@example.com')).status).toBe(200);
  });

  it('staff can sign in without a verified email', async () => {
    await post('sign-up/email', {
      name: 'Mod',
      email: 'mod@example.com',
      password: 'correct horse battery',
    });
    await t.db.database.db
      .collection('users')
      .updateOne({ email: 'mod@example.com' }, { $set: { role: 'moderator' } });
    expect((await signInAs('mod@example.com')).status).toBe(200);
  });
});
