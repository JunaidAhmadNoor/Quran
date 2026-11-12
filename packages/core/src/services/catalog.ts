import { getSurahMeta, loadSurahText, surahs, textSource } from '@tilawah/quran-data';
import type { Actor } from '../actor';
import type { C, Out, ServiceDeps } from '../context';
import { decodeCursor, filtersHash, page } from '../cursor';
import { notFound } from '../errors';
import type { Presenter } from '../presenter';
import { cursorOf } from '../repositories/keyset';
import type { RecitationService } from './recitations';

export class SurahService {
  constructor(private readonly recitations: RecitationService) {}

  list(): Out<typeof C.ListSurahsResponse> {
    return { items: surahs.map((s) => ({ ...s })) };
  }

  async get(actor: Actor | null, n: number, query: Out<typeof C.GetSurahQuery>) {
    const surah = getSurahMeta(n);
    if (!surah) throw notFound('Surah');
    const recitations = await this.recitations.list(actor, {
      surah: n,
      sort: query.sort,
      limit: query.limit,
    });
    return { surah: { ...surah }, recitations };
  }

  async text(n: number): Promise<Out<typeof C.SurahTextResponse>> {
    if (!getSurahMeta(n)) throw notFound('Surah');
    const text = await loadSurahText(n);
    return { ...text, source: { ...textSource } };
  }
}

export class ReciterService {
  constructor(
    private readonly deps: ServiceDeps,
    private readonly presenter: Presenter,
    private readonly recitations: RecitationService,
  ) {}

  async listVerified(query: Out<typeof C.ListRecitersQuery>): Promise<Out<typeof C.ReciterPage>> {
    const hash = filtersHash({ verified: true });
    const rows = await this.deps.repos.users.listVerifiedReciters(
      decodeCursor(query.cursor, hash),
      query.limit,
    );
    const result = page(rows, query.limit, (last) => cursorOf('_id', hash, last));
    return {
      items: result.rows.map((u) => this.presenter.reciterSummary(u, u._id.toHexString())),
      nextCursor: result.nextCursor,
    };
  }

  /** Public only once the user has turned on reciter mode; listener-only accounts stay private. */
  async get(actor: Actor | null, id: string, query: Out<typeof C.GetReciterQuery>) {
    const user = await this.deps.repos.users.findById(id);
    if (!user?.reciterSince) throw notFound('Reciter');
    const [stats, recitations] = await Promise.all([
      this.deps.repos.recitations.uploaderStats(id),
      this.recitations.list(actor, {
        reciterId: id,
        sort: query.sort,
        limit: query.limit,
        cursor: query.cursor,
      }),
    ]);
    return {
      reciter: {
        ...this.presenter.reciterSummary(user, id),
        bio: user.bio ?? null,
        reciterSince: user.reciterSince.toISOString(),
        stats: { approvedRecitations: stats.approved, totalPlays: stats.approvedPlays },
      },
      recitations,
    };
  }
}

export { PlaylistService } from './playlists';
