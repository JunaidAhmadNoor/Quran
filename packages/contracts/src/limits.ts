// Limits that are part of the public contract: clients use them for form validation and
// the server enforces them. Changing one is a contract change (bump the version).

export const MAX_UPLOAD_BYTES = 60 * 1024 * 1024;
export const MIN_UPLOAD_BYTES = 10 * 1024;
export const PRESIGN_TTL_SEC = 10 * 60;
export const MAX_DURATION_SEC = 6 * 60 * 60;

export const MAX_TITLE_LENGTH = 120;
export const MAX_NAME_LENGTH = 80;
export const MAX_BIO_LENGTH = 500;
export const MAX_REPORT_NOTE_LENGTH = 1000;
export const MAX_MODERATION_REASON_LENGTH = 500;

/** Total audio a user may keep in storage (decision D4). */
export const STORAGE_QUOTA_BYTES = 300 * 1024 * 1024;
export const VERIFIED_STORAGE_QUOTA_BYTES = 2 * 1024 * 1024 * 1024;
/** Audio of rejected recitations is deleted this long after rejection (decision D4). */
export const REJECTED_AUDIO_RETENTION_DAYS = 7;

export const MAX_PLAYLIST_ITEMS = 200;
export const MAX_PLAYLISTS_PER_USER = 100;

export const MAX_MISTAKES_PER_SESSION = 2000;
export const MAX_SESSION_DURATION_SEC = 6 * 60 * 60;

export interface RateLimitPolicy {
  /** Requests allowed per window, per signed-in user (or per hashed IP when anonymous). */
  limit: number;
  windowSec: number;
}

export const rateLimits = {
  upload: { limit: 20, windowSec: 60 * 60 },
  write: { limit: 120, windowSec: 60 * 60 },
  like: { limit: 300, windowSec: 60 * 60 },
  report: { limit: 20, windowSec: 24 * 60 * 60 },
  play: { limit: 600, windowSec: 60 * 60 },
  session: { limit: 120, windowSec: 60 * 60 },
  /** Hadith search scans a whole collection. */
  search: { limit: 120, windowSec: 60 * 60 },
} as const satisfies Record<string, RateLimitPolicy>;

export type RateLimitName = keyof typeof rateLimits;

/** A play from the same listener on the same recitation is counted at most once per window. */
export const PLAY_DEDUPE_WINDOW_SEC = 6 * 60 * 60;
