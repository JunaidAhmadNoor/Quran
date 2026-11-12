import type * as C from '@tilawah/contracts';
import type { Database } from '@tilawah/db';
import type { z } from 'zod';
import type { Clock } from './clock';
import { LikeRepository, PlayRepository } from './repositories/engagement';
import {
  MemorizationRepository,
  PlaylistRepository,
  ReportRepository,
} from './repositories/library';
import { RateLimiter } from './repositories/rate-limiter';
import { RecitationRepository } from './repositories/recitations';
import { UserRepository } from './repositories/users';
import type { StoragePort } from './storage/port';

/** Output type of a contract schema: what a service returns. */
export type Out<T extends z.ZodType> = z.output<T>;
export type { C };

export interface CoreConfig {
  uploadTicketSecret: string;
  /** When set, approved audio is served from this public base URL instead of signed URLs. */
  publicAudioBaseUrl: string | null;
}

export function createRepositories(database: Database, clock: Clock) {
  const { models, connection } = database;
  return {
    users: new UserRepository(models),
    recitations: new RecitationRepository(models),
    likes: new LikeRepository(models, connection),
    plays: new PlayRepository(models),
    playlists: new PlaylistRepository(models),
    reports: new ReportRepository(models),
    memorization: new MemorizationRepository(models, connection),
    rateLimiter: new RateLimiter(models, clock),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;

export interface ServiceDeps {
  repos: Repositories;
  storage: StoragePort;
  clock: Clock;
  config: CoreConfig;
}
