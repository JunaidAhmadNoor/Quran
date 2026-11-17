import type { Db, MongoClient } from 'mongodb';
import mongoose, { type Connection } from 'mongoose';
import { playStatDailySchema, rateLimitSchema } from './models/operational';
import { recitationSchema } from './models/recitations';
import { likeSchema, playlistSchema, reportSchema } from './models/social';
import { userSchema } from './models/users';

export type { PlayStatDailyDoc, RateLimitDoc } from './models/operational';
export type { RecitationDoc } from './models/recitations';
export type { LikeDoc, PlaylistDoc, ReportDoc } from './models/social';
export type { UserDoc } from './models/users';
export { Types } from 'mongoose';
export type { ClientSession, Connection } from 'mongoose';

export function createModels(connection: Connection) {
  return {
    User: connection.model('User', userSchema),
    Recitation: connection.model('Recitation', recitationSchema),
    Like: connection.model('Like', likeSchema),
    Playlist: connection.model('Playlist', playlistSchema),
    Report: connection.model('Report', reportSchema),
    RateLimit: connection.model('RateLimit', rateLimitSchema),
    PlayStatDaily: connection.model('PlayStatDaily', playStatDailySchema),
  };
}

export type Models = ReturnType<typeof createModels>;

export interface Database {
  connection: Connection;
  models: Models;
  /** Native handles, shared with Better Auth's MongoDB adapter. */
  client: MongoClient;
  db: Db;
  close(): Promise<void>;
}

export interface ConnectOptions {
  dbName?: string;
  maxPoolSize?: number;
}

/** Opens one connection pool. Call once per process (or per test file). */
export async function connectDatabase(
  uri: string,
  options: ConnectOptions = {},
): Promise<Database> {
  const connection = mongoose.createConnection(uri, {
    maxPoolSize: options.maxPoolSize ?? 10,
    serverSelectionTimeoutMS: 10_000,
    autoIndex: false,
    ...(options.dbName ? { dbName: options.dbName } : {}),
  });
  await connection.asPromise();
  const db = connection.db;
  if (!db) throw new Error('MongoDB connection has no database handle');
  return {
    connection,
    models: createModels(connection),
    client: connection.getClient(),
    db,
    close: () => connection.close(),
  };
}

/** Creates every index (idempotent). Run at startup and in tests. */
export async function ensureIndexes(database: Database): Promise<void> {
  await Promise.all(Object.values(database.models).map((model) => model.createIndexes()));
  // Collections owned by Better Auth.
  const { db } = database;
  await Promise.all([
    db.collection('sessions').createIndex({ token: 1 }, { unique: true }, {}),
    db.collection('sessions').createIndex({ userId: 1 }, {}, {}),
    db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }, {}),
    db.collection('accounts').createIndex({ userId: 1 }, {}, {}),
    db.collection('accounts').createIndex({ providerId: 1, accountId: 1 }, { unique: true }, {}),
    db.collection('verifications').createIndex({ identifier: 1 }, {}, {}),
    db.collection('verifications').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }, {}),
  ]);
}

/** Prints collection sizes (data + indexes) to compare with the 512 MB budget. */
export async function databaseStats(database: Database): Promise<{ totalBytes: number }> {
  const stats = await database.db.command({ dbStats: 1 });
  const total = Number(stats.dataSize ?? 0) + Number(stats.indexSize ?? 0);
  return { totalBytes: total };
}
