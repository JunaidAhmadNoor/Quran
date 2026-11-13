import type { Database } from '@tilawah/db';
import type { Clock } from './clock';
import { createRepositories, type CoreConfig } from './context';
import { Presenter } from './presenter';
import { hashIp } from './repositories/rate-limiter';
import { AccountService } from './services/account';
import { ReciterService, SurahService } from './services/catalog';
import { HadithService } from './services/hadith';
import { MaintenanceService, HealthService } from './services/maintenance';
import { MemorizationService } from './services/memorization';
import { AdminService, ModerationService } from './services/moderation';
import { PlaylistService } from './services/playlists';
import { RecitationService } from './services/recitations';
import { UploadService } from './services/uploads';
import type { StoragePort } from './storage/port';

export interface CoreOptions {
  database: Database;
  storage: StoragePort;
  clock: Clock;
  config: CoreConfig;
}

/** Wires repositories and services. Used by the web composition root and by tests. */
export function createCore({ database, storage, clock, config }: CoreOptions) {
  const repos = createRepositories(database, clock);
  const deps = { repos, storage, clock, config };
  const presenter = new Presenter(deps);
  const recitations = new RecitationService(deps, presenter);
  const playlists = new PlaylistService(deps, presenter);

  return {
    clock,
    rateLimiter: repos.rateLimiter,
    hashIp,
    users: repos.users,
    surahs: new SurahService(recitations),
    hadith: new HadithService(),
    recitations,
    uploads: new UploadService(deps, presenter),
    reciters: new ReciterService(deps, presenter, recitations),
    playlists,
    account: new AccountService(deps, presenter, recitations, playlists),
    memorization: new MemorizationService(deps),
    moderation: new ModerationService(deps, presenter, recitations),
    admin: new AdminService(deps, presenter),
    maintenance: new MaintenanceService(deps, recitations),
    health: new HealthService(database),
  };
}

export type Core = ReturnType<typeof createCore>;
