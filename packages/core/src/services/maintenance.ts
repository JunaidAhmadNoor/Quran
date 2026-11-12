import { REJECTED_AUDIO_RETENTION_DAYS } from '@tilawah/contracts';
import type { Database } from '@tilawah/db';
import { DAY_MS } from '../clock';
import type { ServiceDeps } from '../context';
import { DomainError } from '../errors';
import type { RecitationService } from './recitations';

export class MaintenanceService {
  constructor(
    private readonly deps: ServiceDeps,
    private readonly recitations: RecitationService,
  ) {}

  /** Deletes audio of removed recitations and of rejected ones past retention. */
  async purgeAudio(): Promise<{ purged: number }> {
    const cutoff = new Date(
      this.deps.clock.now().getTime() - REJECTED_AUDIO_RETENTION_DAYS * DAY_MS,
    );
    const due = await this.deps.repos.recitations.audioToPurge(cutoff);
    for (const doc of due) await this.recitations.purgeAudio(doc);
    return { purged: due.length };
  }
}

export class HealthService {
  constructor(private readonly database: Database) {}

  async check(apiVersion: string, now: Date) {
    try {
      await this.database.db.command({ ping: 1 });
    } catch {
      throw new DomainError('SERVICE_UNAVAILABLE', 'Database unavailable');
    }
    return {
      status: 'ok' as const,
      apiVersion,
      time: now.toISOString(),
      checks: { database: 'ok' as const },
    };
  }
}
