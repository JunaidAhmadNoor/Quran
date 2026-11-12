// Composition root: the only module in apps/web allowed to touch the database package.
import contractsPackage from '@tilawah/contracts/package.json' with { type: 'json' };
import {
  MemoryStorage,
  R2Storage,
  createCore,
  createR2Client,
  systemClock,
  type Core,
  type StoragePort,
} from '@tilawah/core';
import { connectDatabase, ensureIndexes, type Database } from '@tilawah/db';
import { createAuth, type Auth } from './auth';
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
}

export const API_VERSION = contractsPackage.version;

let instance: Promise<AppContainer> | undefined;

export function getContainer(): Promise<AppContainer> {
  instance ??= build(loadEnv());
  return instance;
}

/** Tests install their own container (in-memory database, fake sessions). */
export function setContainer(container: AppContainer | undefined): void {
  instance = container ? Promise.resolve(container) : undefined;
}

function createStorage(env: Env): StoragePort {
  if (env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET) {
    const client = createR2Client({
      accountId: env.R2_ACCOUNT_ID,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      bucket: env.R2_BUCKET,
    });
    return new R2Storage(client, env.R2_BUCKET);
  }
  console.warn('R2 is not configured: using in-memory storage. Uploads will not persist.');
  return new MemoryStorage();
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
