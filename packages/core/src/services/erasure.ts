import type { ServiceDeps } from '../context';
import type { RecitationService } from './recitations';

/**
 * Deletes a user and everything tied to them. Used by self-deletion (DELETE /me) and by admins
 * (DELETE /admin/users/{id}).
 *
 * Audio is deleted from storage first. If a storage delete fails, that recitation stays as
 * `removed` (no longer visible anywhere) and the daily maintenance job retries the delete and then
 * removes the record (`cleanUp`).
 */
export class ErasureService {
  constructor(
    private readonly deps: ServiceDeps,
    private readonly recitations: RecitationService,
  ) {}

  async eraseUser(userId: string): Promise<void> {
    const { repos } = this.deps;
    for (const doc of await repos.recitations.idsByUploader(userId)) {
      if (doc.status !== 'removed')
        await repos.recitations.update(doc._id.toHexString(), { status: 'removed' });
      await this.recitations.purgeAudio(doc);
    }
    await repos.likes.deleteByUser(userId);
    await repos.playlists.deleteByOwner(userId);
    await repos.reports.deleteByReporter(userId);
    await repos.users.deleteWithAuthRecords(userId);
    // Now that the user is gone, their recitation records (and what points to them) can go too.
    await repos.recitations.deleteOrphans();
  }

  /** Removes data left behind by deleted users. Run by the daily maintenance job. */
  async cleanUp(): Promise<{ recitations: number; authRecords: number }> {
    const { repos } = this.deps;
    return {
      recitations: await repos.recitations.deleteOrphans(),
      authRecords: await repos.users.deleteOrphanAuthRecords(),
    };
  }
}
