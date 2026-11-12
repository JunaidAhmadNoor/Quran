// Turns database documents into contract shapes. The only place that decides which fields a
// caller may see (moderation note, size) and that signs stream URLs.
import type { PlaylistDoc, RecitationDoc, UserDoc } from '@tilawah/db';
import { isStaff, type Actor } from './actor';
import type { C, Out, ServiceDeps } from './context';

const APPROVED_URL_TTL_SEC = 6 * 60 * 60;
const PRIVATE_URL_TTL_SEC = 15 * 60;

const DELETED_USER = {
  name: 'Deleted account',
  image: null,
  country: null,
  verifiedReciter: false,
};

export class Presenter {
  constructor(private readonly deps: ServiceDeps) {}

  reciterSummary(user: UserDoc | undefined, id: string): Out<typeof C.ReciterSummary> {
    if (!user) return { id, ...DELETED_USER };
    return {
      id: user._id.toHexString(),
      name: user.name,
      image: user.image ?? null,
      country: user.country ?? null,
      verifiedReciter: user.verifiedReciter,
    };
  }

  userAccount(user: UserDoc): Out<typeof C.UserAccount> {
    return {
      id: user._id.toHexString(),
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image ?? null,
      role: user.role,
      mode: user.mode,
      reciterSince: user.reciterSince?.toISOString() ?? null,
      verifiedReciter: user.verifiedReciter,
      bio: user.bio ?? null,
      country: user.country ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async recitations(
    docs: RecitationDoc[],
    actor: Actor | null,
  ): Promise<Out<typeof C.Recitation>[]> {
    return (await this.details(docs, actor)).map(
      ({ sizeBytes: _s, moderationNote: _m, ...rest }) => rest,
    );
  }

  async details(
    docs: RecitationDoc[],
    actor: Actor | null,
  ): Promise<Out<typeof C.RecitationDetail>[]> {
    if (docs.length === 0) return [];
    const ids = docs.map((d) => d._id.toHexString());
    const uploaderIds = [...new Set(docs.map((d) => d.uploaderId.toHexString()))];
    const [users, liked] = await Promise.all([
      this.deps.repos.users.findByIds(uploaderIds),
      actor
        ? this.deps.repos.likes.likedIds(actor.userId, ids)
        : Promise.resolve(new Set<string>()),
    ]);
    const byId = new Map(users.map((u) => [u._id.toHexString(), u]));

    return Promise.all(
      docs.map(async (doc) => {
        const id = doc._id.toHexString();
        const uploaderId = doc.uploaderId.toHexString();
        const isOwner = actor?.userId === uploaderId;
        const privileged = isOwner || isStaff(actor);
        return {
          id,
          surah: doc.surah,
          ayahFrom: doc.ayahFrom,
          ayahTo: doc.ayahTo,
          title: doc.title,
          riwayah: doc.riwayah,
          style: doc.style,
          durationSec: doc.durationSec,
          status: doc.status,
          playCount: doc.playCount,
          likeCount: doc.likeCount,
          createdAt: doc.createdAt.toISOString(),
          reciter: this.reciterSummary(byId.get(uploaderId), uploaderId),
          stream: await this.stream(doc),
          viewer: actor ? { liked: liked.has(id), isOwner } : null,
          sizeBytes: privileged ? doc.sizeBytes : null,
          moderationNote: privileged ? doc.moderationNote : null,
        };
      }),
    );
  }

  playlist(doc: PlaylistDoc, owner: UserDoc | undefined): Out<typeof C.Playlist> {
    const ownerId = doc.ownerId.toHexString();
    return {
      id: doc._id.toHexString(),
      name: doc.name,
      isPublic: doc.isPublic,
      owner: { id: ownerId, name: owner?.name ?? DELETED_USER.name },
      recitationCount: doc.recitationIds.length,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  private async stream(doc: RecitationDoc): Promise<Out<typeof C.StreamInfo>> {
    const { clock, config, storage } = this.deps;
    const approved = doc.status === 'approved';
    if (approved && config.publicAudioBaseUrl) {
      return {
        url: `${config.publicAudioBaseUrl.replace(/\/$/, '')}/${doc.audioKey}`,
        expiresAt: null,
        contentType: doc.audioContentType,
      };
    }
    const ttl = approved ? APPROVED_URL_TTL_SEC : PRIVATE_URL_TTL_SEC;
    return {
      url: await storage.presignGet({ key: doc.audioKey, expiresInSec: ttl }),
      expiresAt: new Date(clock.now().getTime() + ttl * 1000).toISOString(),
      contentType: doc.audioContentType,
    };
  }
}
