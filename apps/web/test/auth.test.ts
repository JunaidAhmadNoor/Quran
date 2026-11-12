// Real Better Auth against the in-memory database: proves the same endpoints work with the web
// session cookie and with the mobile Bearer token, and that sessions store no IP address.
import { setContainer, type AppContainer } from '@/server/container';
import { createAuth } from '@/server/auth';
import { ConsoleEmail } from '@/server/email';
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
