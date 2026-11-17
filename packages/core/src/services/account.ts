import type { UserDoc } from '@tilawah/db';
import { requireActor, requireReciterProfile, type Actor } from '../actor';
import { DAY_MS, utcDay } from '../clock';
import type { C, Out, ServiceDeps } from '../context';
import { decodeCursor, filtersHash, page } from '../cursor';
import { DomainError, conflict, notFound } from '../errors';
import type { Presenter } from '../presenter';
import { cursorOf } from '../repositories/keyset';
import type { PlaylistService } from './playlists';
import type { RecitationService } from './recitations';
import { storageQuota } from './uploads';

/** A session younger than this may delete the account. */
const FRESH_SESSION_MS = DAY_MS;

export class AccountService {
  constructor(
    private readonly deps: ServiceDeps,
    private readonly presenter: Presenter,
    private readonly recitations: RecitationService,
    private readonly playlists: PlaylistService,
  ) {}

  /** The account view of a user record already loaded for this request (saves a query). */
  present(user: UserDoc) {
    return this.presenter.userAccount(user);
  }

  async me(actor: Actor | null) {
    const me = requireActor(actor);
    const user = await this.deps.repos.users.findById(me.userId);
    if (!user) throw notFound('Account');
    return this.presenter.userAccount(user);
  }

  async update(actor: Actor | null, body: Out<typeof C.UpdateMeBody>) {
    const me = requireActor(actor);
    const user = await this.deps.repos.users.update(me.userId, body);
    if (!user) throw notFound('Account');
    return this.presenter.userAccount(user);
  }

  /** Fiverr-style switch. The first switch to reciter turns on the public reciter profile. */
  async switchMode(actor: Actor | null, body: Out<typeof C.SwitchModeBody>) {
    const me = requireActor(actor);
    const turnOnProfile = body.mode === 'reciter' && !me.reciterSince;
    const user = await this.deps.repos.users.update(me.userId, {
      mode: body.mode,
      ...(turnOnProfile ? { reciterSince: this.deps.clock.now() } : {}),
    });
    if (!user) throw notFound('Account');
    return this.presenter.userAccount(user);
  }

  async library(actor: Actor | null, query: Out<typeof C.LibraryQuery>) {
    const me = requireActor(actor);
    const hash = filtersHash({ likesOf: me.userId });
    const likes = await this.deps.repos.likes.listByUser(
      me.userId,
      decodeCursor(query.cursor, hash),
      query.limit,
    );
    const result = page(likes, query.limit, (last) => cursorOf('createdAt', hash, last));
    const ids = result.rows.map((l) => l.recitationId.toHexString());
    const docs = await this.deps.repos.recitations.findByIds(ids);
    const byId = new Map(
      docs.filter((d) => d.status === 'approved').map((d) => [d._id.toHexString(), d]),
    );
    const ordered = ids.flatMap((id) => {
      const d = byId.get(id);
      return d ? [d] : [];
    });
    return {
      likes: {
        items: await this.presenter.recitations(ordered, me),
        nextCursor: result.nextCursor,
      },
      playlists: await this.playlists.allOf(me.userId),
    };
  }

  async reciterStats(actor: Actor | null): Promise<Out<typeof C.ReciterStats>> {
    const me = requireActor(actor);
    requireReciterProfile(me);
    const { recitations, plays } = this.deps.repos;
    const [stats, used, mine] = await Promise.all([
      recitations.uploaderStats(me.userId),
      recitations.storageUsed(me.userId),
      recitations.idsByUploader(me.userId),
    ]);
    const since = utcDay(new Date(this.deps.clock.now().getTime() - 6 * DAY_MS));
    return {
      recitations: { pending: stats.pending, approved: stats.approved, rejected: stats.rejected },
      totalPlays: stats.totalPlays,
      totalLikes: stats.totalLikes,
      playsLast7Days: await plays.playsSince(
        mine.map((r) => r._id.toHexString()),
        since,
      ),
      storage: { usedBytes: used, quotaBytes: storageQuota(me) },
    };
  }

  /** Deletes the account and its data; recitations become removed and their audio is deleted. */
  async deleteAccount(actor: Actor | null): Promise<void> {
    const me = requireActor(actor);
    const { repos, clock } = this.deps;
    if (clock.now().getTime() - me.sessionCreatedAt.getTime() > FRESH_SESSION_MS) {
      throw new DomainError('REAUTH_REQUIRED', 'Sign in again to delete your account');
    }
    if (me.role === 'admin' && (await repos.users.countAdmins()) <= 1) {
      throw conflict('The last admin cannot delete their account');
    }
    for (const doc of await repos.recitations.idsByUploader(me.userId)) {
      if (doc.status !== 'removed')
        await repos.recitations.update(doc._id.toHexString(), { status: 'removed' });
      await this.recitations.purgeAudio(doc);
    }
    await repos.likes.deleteByUser(me.userId);
    await repos.playlists.deleteByOwner(me.userId);
    await repos.users.deleteWithAuthRecords(me.userId);
  }
}
