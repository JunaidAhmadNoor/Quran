// One line per endpoint: which service call answers it. No rules live here.
import { endpoints, type EndpointName, type Endpoints } from '@tilawah/contracts';
import { route, type Handler } from './route';

type HandlerMap = { [K in EndpointName]: Handler<Endpoints[K]> };

export const handlers: HandlerMap = {
  getHealth: ({ core, config }) => core.health.check(config.apiVersion, core.clock.now()),

  listSurahs: ({ core }) => core.surahs.list(),
  getSurah: ({ core, actor, params, query }) => core.surahs.get(actor, params.n, query),
  getSurahText: ({ core, params }) => core.surahs.text(params.n),

  listRecitations: ({ core, actor, query }) => core.recitations.list(actor, query),
  getRecitation: ({ core, actor, params }) => core.recitations.get(actor, params.id),
  recordPlay: ({ core, subject, params }) => core.recitations.recordPlay(subject, params.id),
  createRecitation: ({ core, actor, body }) => core.uploads.confirm(actor, body),
  updateRecitation: ({ core, actor, params, body }) =>
    core.recitations.update(actor, params.id, body),
  deleteRecitation: async ({ core, actor, params }) => {
    await core.recitations.remove(actor, params.id);
    return undefined;
  },
  likeRecitation: ({ core, actor, params }) => core.recitations.like(actor, params.id),
  unlikeRecitation: ({ core, actor, params }) => core.recitations.unlike(actor, params.id),
  reportRecitation: ({ core, actor, params, body }) =>
    core.recitations.report(actor, params.id, body),

  presignUpload: ({ core, actor, body }) => core.uploads.presign(actor, body),

  listReciters: ({ core, query }) => core.reciters.listVerified(query),
  getReciter: ({ core, actor, params, query }) => core.reciters.get(actor, params.id, query),

  listPlaylists: ({ core, actor, query }) => core.playlists.listMine(actor, query),
  createPlaylist: ({ core, actor, body }) => core.playlists.create(actor, body),
  getPlaylist: ({ core, actor, params }) => core.playlists.get(actor, params.id),
  updatePlaylist: ({ core, actor, params, body }) => core.playlists.update(actor, params.id, body),
  deletePlaylist: async ({ core, actor, params }) => {
    await core.playlists.remove(actor, params.id);
    return undefined;
  },

  getMe: ({ core, actor }) => core.account.me(actor),
  updateMe: ({ core, actor, body }) => core.account.update(actor, body),
  switchMode: ({ core, actor, body }) => core.account.switchMode(actor, body),
  deleteMe: async ({ core, actor }) => {
    await core.account.deleteAccount(actor);
    return undefined;
  },
  getReciterStats: ({ core, actor }) => core.account.reciterStats(actor),
  getLibrary: ({ core, actor, query }) => core.account.library(actor, query),
  listMyRecitations: ({ core, actor, query }) => core.recitations.listMine(actor, query),

  getModerationQueue: ({ core, actor, query }) => core.moderation.queue(actor, query),
  decideRecitation: ({ core, actor, params, body }) =>
    core.moderation.decideRecitation(actor, params.id, body),
  decideReport: ({ core, actor, params, body }) =>
    core.moderation.decideReport(actor, params.id, body),

  listHadithBooks: ({ core }) => core.hadith.listBooks(),
  getHadithBook: ({ core, params }) => core.hadith.getBook(params.book),
  getHadithSection: ({ core, params, query }) =>
    core.hadith.getSection(params.book, params.section, query),
  getHadith: ({ core, params }) => core.hadith.getHadith(params.book, params.number),
  searchHadith: ({ core, params, query }) => core.hadith.search(params.book, query),
  adminStats: ({ core, actor }) => core.admin.stats(actor),
  listUsers: ({ core, actor, query }) => core.admin.listUsers(actor, query),
  updateUser: ({ core, actor, params, body }) => core.admin.updateUser(actor, params.id, body),
};

/** Builds the Next.js route export for one endpoint. */
// K ties endpoints[name] to handlers[name]; without it TypeScript sees two unrelated unions.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function handle<K extends EndpointName>(name: K) {
  return route(endpoints[name], handlers[name]);
}
