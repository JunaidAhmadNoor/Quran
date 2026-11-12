import { MAX_PLAYLISTS_PER_USER } from '@tilawah/contracts';
import type { PlaylistDoc } from '@tilawah/db';
import { requireActor, type Actor } from '../actor';
import type { C, Out, ServiceDeps } from '../context';
import { decodeCursor, filtersHash, page } from '../cursor';
import { DomainError, forbidden, notFound } from '../errors';
import type { Presenter } from '../presenter';
import { cursorOf } from '../repositories/keyset';

export class PlaylistService {
  constructor(
    private readonly deps: ServiceDeps,
    private readonly presenter: Presenter,
  ) {}

  async listMine(actor: Actor | null, query: Out<typeof C.ListPlaylistsQuery>) {
    const me = requireActor(actor);
    const hash = filtersHash({ owner: me.userId });
    const rows = await this.deps.repos.playlists.listByOwner(
      me.userId,
      decodeCursor(query.cursor, hash),
      query.limit,
    );
    const result = page(rows, query.limit, (last) => cursorOf('updatedAt', hash, last));
    return { items: await this.present(result.rows), nextCursor: result.nextCursor };
  }

  /** All playlists of a user, for the library (bounded by MAX_PLAYLISTS_PER_USER). */
  async allOf(userId: string): Promise<Out<typeof C.Playlist>[]> {
    const rows = await this.deps.repos.playlists.listByOwner(userId, null, MAX_PLAYLISTS_PER_USER);
    return this.present(rows.slice(0, MAX_PLAYLISTS_PER_USER));
  }

  async create(actor: Actor | null, body: Out<typeof C.CreatePlaylistBody>) {
    const me = requireActor(actor);
    const { playlists } = this.deps.repos;
    if ((await playlists.countByOwner(me.userId)) >= MAX_PLAYLISTS_PER_USER) {
      throw new DomainError(
        'QUOTA_EXCEEDED',
        `You can have at most ${MAX_PLAYLISTS_PER_USER} playlists`,
      );
    }
    await this.assertApproved(body.recitationIds);
    const doc = await playlists.insert({ ownerId: me.userId, ...body });
    const [presented] = await this.present([doc]);
    if (!presented) throw notFound('Playlist');
    return presented;
  }

  async get(actor: Actor | null, id: string): Promise<Out<typeof C.PlaylistDetail>> {
    const doc = await this.deps.repos.playlists.findById(id);
    const isOwner = doc?.ownerId.toHexString() === actor?.userId;
    if (!doc || (!doc.isPublic && !isOwner)) throw notFound('Playlist');
    const ids = doc.recitationIds.map((r) => r.toHexString());
    const found = await this.deps.repos.recitations.findByIds(ids);
    const byId = new Map(
      found.filter((r) => r.status === 'approved').map((r) => [r._id.toHexString(), r]),
    );
    const ordered = ids.flatMap((rid) => {
      const r = byId.get(rid);
      return r ? [r] : [];
    });
    const [base] = await this.present([doc]);
    if (!base) throw notFound('Playlist');
    return { ...base, recitations: await this.presenter.recitations(ordered, actor) };
  }

  async update(actor: Actor | null, id: string, body: Out<typeof C.UpdatePlaylistBody>) {
    const me = requireActor(actor);
    await this.owned(me, id);
    if (body.recitationIds) await this.assertApproved(body.recitationIds);
    const doc = await this.deps.repos.playlists.update(id, body);
    if (!doc) throw notFound('Playlist');
    const [presented] = await this.present([doc]);
    if (!presented) throw notFound('Playlist');
    return presented;
  }

  async remove(actor: Actor | null, id: string): Promise<void> {
    const me = requireActor(actor);
    await this.owned(me, id);
    await this.deps.repos.playlists.delete(id);
  }

  private async owned(me: Actor, id: string): Promise<PlaylistDoc> {
    const doc = await this.deps.repos.playlists.findById(id);
    if (!doc) throw notFound('Playlist');
    if (doc.ownerId.toHexString() !== me.userId) {
      if (doc.isPublic) throw forbidden('You can only change your own playlists');
      throw notFound('Playlist');
    }
    return doc;
  }

  private async assertApproved(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const found = await this.deps.repos.recitations.findByIds(ids);
    const approved = new Set(
      found.filter((r) => r.status === 'approved').map((r) => r._id.toHexString()),
    );
    const missing = ids.filter((id) => !approved.has(id));
    if (missing.length > 0) {
      throw new DomainError('NOT_FOUND', 'Some recitations do not exist or are not public', {
        missing,
      });
    }
  }

  private async present(docs: PlaylistDoc[]) {
    const owners = await this.deps.repos.users.findByIds([
      ...new Set(docs.map((d) => d.ownerId.toHexString())),
    ]);
    const byId = new Map(owners.map((u) => [u._id.toHexString(), u]));
    return docs.map((d) => this.presenter.playlist(d, byId.get(d.ownerId.toHexString())));
  }
}
