// Composition root: the only module in apps/web allowed to touch the database package.
import contractsPackage from '@tilawah/contracts/package.json' with { type: 'json' };
import {
  R2Storage,
  createCore,
  createR2Client,
  systemClock,
  type Core,
  type StoragePort,
} from '@tilawah/core';
import { connectDatabase, ensureIndexes, type Database } from '@tilawah/db';
import { resolve } from 'node:path';
import { createAuth, type Auth } from './auth';
import { LocalDiskStorage } from './local-storage';
import { BrevoEmail, ConsoleEmail } from './email';
import { loadEnv, type Env } from './env';

export interface SessionInfo {
  userId: string;
  sessionCreatedAt: Date;
}

export interface AppConfig {
  allowedOrigins: string[];
  ipHashSecret: string;
  apiVersion: string;
  production: boolean;
}

export interface AppContainer {
  core: Core;
  config: AppConfig;
  /** Reads the session from the cookie (web) or the Bearer token (mobile). */
  resolveSession(headers: Headers): Promise<SessionInfo | null>;
  auth: Auth | null;
  /** For dev scripts (seed, maintenance) only; request handling never touches it. */
  database: Database | null;
  storage: StoragePort | null;
  /** Whether "Continue with Google" should be offered. */
  googleEnabled: boolean;
}

export const API_VERSION = contractsPackage.version;

let instance: Promise<AppContainer> | undefined;

export function getContainer(): Promise<AppContainer> {
  instance ??= Promise.resolve()
    .then(() => build(loadEnv()))
    .catch((error: unknown) => {
      instance = undefined; // retry on the next request instead of caching the failure
      throw error;
    });
  return instance;
}

/** Tests install their own container (in-memory database, fake sessions). */
export function setContainer(container: AppContainer | undefined): void {
  instance = container ? Promise.resolve(container) : undefined;
}

function createStorage(env: Env): StoragePort {
  const r2Configured = Boolean(
    env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET,
  );
  if (env.STORAGE_DRIVER === 'local' || !r2Configured) {
    const dir = resolve(env.LOCAL_STORAGE_DIR ?? '.data/storage');
    console.warn(`Storage: local disk at ${dir} (R2 not configured).`);
    return new LocalDiskStorage(
      dir,
      env.BETTER_AUTH_URL.replace(/\/$/, ''),
      `${env.UPLOAD_TICKET_SECRET}:local-storage`,
    );
  }
  if (env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET) {
    const client = createR2Client({
      accountId: env.R2_ACCOUNT_ID,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      bucket: env.R2_BUCKET,
    });
    return new R2Storage(client, env.R2_BUCKET);
  }
  throw new Error('R2 is not fully configured');
}

async function build(env: Env): Promise<AppContainer> {
  const database = await connectDatabase(env.MONGODB_URI);
  await ensureIndexes(database);
  const storage = createStorage(env);
  const core = createCore({
    database,
    storage,
    clock: systemClock,
    config: {
      uploadTicketSecret: env.UPLOAD_TICKET_SECRET,
      publicAudioBaseUrl: env.R2_PUBLIC_BASE_URL ?? null,
    },
  });
  const email =
    env.EMAIL_TRANSPORT === 'brevo' && env.BREVO_API_KEY && env.EMAIL_FROM
      ? new BrevoEmail(env.BREVO_API_KEY, env.EMAIL_FROM)
      : new ConsoleEmail(env.NODE_ENV !== 'production');
  const auth = createAuth({ database, env, email, core });

  return {
    core,
    auth,
    database,
    storage,
    googleEnabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    config: {
      allowedOrigins: env.API_ALLOWED_ORIGINS,
      ipHashSecret: env.IP_HASH_SECRET,
      apiVersion: API_VERSION,
      production: env.NODE_ENV === 'production',
    },
    async resolveSession(headers) {
      const result = await auth.api.getSession({ headers });
      if (!result) return null;
      return {
        userId: result.session.userId,
        sessionCreatedAt: new Date(result.session.createdAt),
      };
    },
  };
}
