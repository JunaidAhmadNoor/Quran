// In-memory MongoDB replica set for tests. A replica set (not a standalone server) is needed
// because likes and moderation decisions use transactions. Never connects to a real database.
import { MongoMemoryReplSet } from 'mongodb-memory-server-core';
import { connectDatabase, ensureIndexes, type Database } from './index';

/** Atlas M0 runs MongoDB 8.0, so tests do too. Override with MONGOMS_VERSION. */
const MONGO_VERSION = process.env.MONGOMS_VERSION ?? '8.0.12';

export interface TestDatabase {
  database: Database;
  uri: string;
  /** Deletes every document, keeping indexes. Call between tests. */
  reset(): Promise<void>;
  stop(): Promise<void>;
}

export async function startTestDatabase(): Promise<TestDatabase> {
  const server = await MongoMemoryReplSet.create({
    binary: { version: MONGO_VERSION },
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  const uri = server.getUri('tilawah_test');
  const database = await connectDatabase(uri, { maxPoolSize: 5 });
  await ensureIndexes(database);

  return {
    database,
    uri,
    async reset() {
      const collections = await database.db.collections();
      await Promise.all(collections.map((c) => c.deleteMany({})));
    },
    async stop() {
      await database.close();
      await server.stop();
    },
  };
}
