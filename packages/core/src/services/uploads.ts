import {
  AudioContentType,
  MAX_UPLOAD_BYTES,
  MIN_UPLOAD_BYTES,
  PRESIGN_TTL_SEC,
  STORAGE_QUOTA_BYTES,
  VERIFIED_STORAGE_QUOTA_BYTES,
} from '@tilawah/contracts';
import { isValidAyahRange } from '@tilawah/quran-data';
import { autoApproves, requireActor, requireReciterProfile, type Actor } from '../actor';
import type { C, Out, ServiceDeps } from '../context';
import { DomainError, conflict, forbidden, invalid } from '../errors';
import type { Presenter } from '../presenter';
import { newId, oid } from '../repositories/keyset';
import { signUploadTicket, verifyUploadTicket } from '../upload-token';

/** Extra time after the PUT URL expires for an upload that started in time to finish. */
const UPLOAD_GRACE_MS = 60 * 60 * 1000;

const EXTENSION: Record<AudioContentType, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
};

/** Bitrate bounds used to sanity-check the client-reported duration (bits per second). */
const MIN_BITRATE = 4_000;
const MAX_BITRATE = 2_000_000;

export const storageQuota = (actor: Actor): number =>
  autoApproves(actor) ? VERIFIED_STORAGE_QUOTA_BYTES : STORAGE_QUOTA_BYTES;

export class UploadService {
  constructor(
    private readonly deps: ServiceDeps,
    private readonly presenter: Presenter,
  ) {}

  async presign(actor: Actor | null, body: Out<typeof C.PresignUploadBody>) {
    const me = requireActor(actor);
    requireReciterProfile(me);
    const contentType = AudioContentType.safeParse(body.contentType);
    if (!contentType.success) {
      throw new DomainError(
        'UNSUPPORTED_MEDIA_TYPE',
        `Unsupported audio type ${body.contentType}`,
        {
          allowed: AudioContentType.options,
        },
      );
    }
    if (body.sizeBytes > MAX_UPLOAD_BYTES) {
      throw new DomainError('FILE_TOO_LARGE', 'Audio files can be at most 60 MB', {
        maxBytes: MAX_UPLOAD_BYTES,
      });
    }
    if (body.sizeBytes < MIN_UPLOAD_BYTES)
      throw invalid('The file is too small to be a recitation', ['sizeBytes']);
    this.assertRange(body.surah, body.ayahFrom, body.ayahTo);
    await this.assertQuota(me, body.sizeBytes);

    const now = this.deps.clock.now();
    const uploadId = newId().toHexString();
    const key = `incoming/${me.userId}/${uploadId}.${EXTENSION[contentType.data]}`;
    const { url, headers } = await this.deps.storage.presignPut({
      key,
      contentType: contentType.data,
      sizeBytes: body.sizeBytes,
      expiresInSec: PRESIGN_TTL_SEC,
    });
    const urlExpiresAt = now.getTime() + PRESIGN_TTL_SEC * 1000;
    const uploadToken = signUploadTicket(
      {
        v: 1,
        uploadId,
        userId: me.userId,
        key,
        contentType: contentType.data,
        sizeBytes: body.sizeBytes,
        surah: body.surah,
        ayahFrom: body.ayahFrom,
        ayahTo: body.ayahTo,
        rightsConfirmedAt: now.toISOString(),
        exp: urlExpiresAt + UPLOAD_GRACE_MS,
      },
      this.deps.config.uploadTicketSecret,
    );
    return {
      uploadUrl: url,
      method: 'PUT' as const,
      headers,
      uploadToken,
      expiresAt: new Date(urlExpiresAt).toISOString(),
    };
  }

  /** Confirms an upload: checks the token and the stored object, then creates the recitation. */
  async confirm(actor: Actor | null, body: Out<typeof C.CreateRecitationBody>) {
    const me = requireActor(actor);
    requireReciterProfile(me);
    const { config, repos, storage, clock } = this.deps;
    const ticket = verifyUploadTicket(body.uploadToken, config.uploadTicketSecret, clock.now());
    if (ticket.userId !== me.userId) throw forbidden('This upload belongs to another account');
    if (await repos.recitations.findById(ticket.uploadId))
      throw conflict('This upload was already confirmed');

    const object = await storage.head(ticket.key);
    if (!object) {
      throw new DomainError(
        'UPLOAD_NOT_FOUND',
        'No uploaded file was found. Upload the file before confirming.',
      );
    }
    if (
      object.sizeBytes !== ticket.sizeBytes ||
      (object.contentType ?? ticket.contentType) !== ticket.contentType
    ) {
      await storage.delete(ticket.key);
      throw new DomainError(
        'UPLOAD_MISMATCH',
        'The uploaded file does not match what was presigned',
        {
          expected: { sizeBytes: ticket.sizeBytes, contentType: ticket.contentType },
          actual: object,
        },
      );
    }
    const bitrate = (ticket.sizeBytes * 8) / body.durationSec;
    if (bitrate < MIN_BITRATE || bitrate > MAX_BITRATE) {
      throw invalid('durationSec does not match the file size', ['durationSec']);
    }
    await this.assertQuota(me, ticket.sizeBytes);

    const audioKey = `audio/${ticket.uploadId}.${EXTENSION[ticket.contentType]}`;
    await storage.copy(ticket.key, audioKey);
    await storage.delete(ticket.key);
    try {
      const doc = await repos.recitations.insert({
        _id: oid(ticket.uploadId),
        uploaderId: oid(me.userId),
        surah: ticket.surah,
        ayahFrom: ticket.ayahFrom,
        ayahTo: ticket.ayahTo,
        title: body.title,
        riwayah: body.riwayah,
        style: body.style,
        audioKey,
        audioContentType: ticket.contentType,
        audioDeletedAt: null,
        durationSec: body.durationSec,
        sizeBytes: ticket.sizeBytes,
        status:
          body.visibility === 'private' ? 'private' : autoApproves(me) ? 'approved' : 'pending',
        playCount: 0,
        likeCount: 0,
        rightsConfirmedAt: new Date(ticket.rightsConfirmedAt),
        moderationNote: null,
        moderatedBy: null,
        moderatedAt: null,
      });
      const [detail] = await this.presenter.details([doc], me);
      if (!detail) throw new Error('Created recitation could not be presented');
      return detail;
    } catch (error) {
      if ((error as { code?: number }).code === 11000)
        throw conflict('This upload was already confirmed');
      throw error;
    }
  }

  private assertRange(surah: number, from: number, to: number): void {
    if (!isValidAyahRange(surah, from, to)) {
      throw new DomainError('INVALID_AYAH_RANGE', `Surah ${surah} has no ayahs ${from}–${to}`);
    }
  }

  private async assertQuota(actor: Actor, extraBytes: number): Promise<void> {
    const used = await this.deps.repos.recitations.storageUsed(actor.userId);
    const quota = storageQuota(actor);
    if (used + extraBytes > quota) {
      throw new DomainError('QUOTA_EXCEEDED', 'Your storage quota is full', {
        usedBytes: used,
        quotaBytes: quota,
      });
    }
  }
}
