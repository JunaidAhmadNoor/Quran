# Tilawah — API v1

The website and the mobile app use exactly these endpoints. The source of truth is
[`packages/contracts`](../packages/contracts/src) (Zod), from which
[`openapi.json`](../packages/contracts/openapi.json) is generated. This page explains the
conventions and lists every endpoint; field-level schemas are in the OpenAPI file.

Base URL: `https://<host>/api/v1` · Content type: `application/json` only.

---

## 1. Authentication

| Client  | How                                                                                          |
| ------- | -------------------------------------------------------------------------------------------- |
| Website | HTTP-only session cookie `tilawah.session_token` (Secure, SameSite=Lax), set by Better Auth. |
| Mobile  | `Authorization: Bearer <session token>` from Better Auth's Expo client. No cookies.          |

Auth levels used below: **public** (no session needed; if one is sent it is used, e.g. for
`viewer.liked` or to let an owner see their pending upload) · **user** · **moderator**
(moderator or admin) · **admin**. `role` is staff-only (`user`, `moderator`, `admin`).

**Listener and reciter modes.** Every account can switch sides at any time with
`PUT /me/mode` (Fiverr-style). The switch takes effect on the next request; the session and
token stay valid, so there is no sign-out. Uploading needs the reciter profile to be on
(`reciterSince` set by the first switch to reciter), otherwise `RECITER_PROFILE_REQUIRED`.
Switching mode never skips review: only the staff-granted `verifiedReciter` badge does.
Details: [ARCHITECTURE.md §5](ARCHITECTURE.md#5-accounts-authentication-modes-and-roles).

Cookie-authenticated writes must send an `Origin` header that is in the allowed list
(CSRF protection). Bearer requests are exempt.

### Better Auth endpoints (not versioned by us)

Mounted at `/api/auth`. The main ones the clients use:

| Method | Path                                | Purpose                                   |
| ------ | ----------------------------------- | ----------------------------------------- |
| POST   | `/api/auth/sign-up/email`           | Create account (name, email, password)    |
| POST   | `/api/auth/sign-in/email`           | Sign in with email + password             |
| POST   | `/api/auth/sign-in/social`          | Start Google OAuth (`provider: "google"`) |
| GET    | `/api/auth/get-session`             | Current session                           |
| POST   | `/api/auth/sign-out`                | Sign out                                  |
| POST   | `/api/auth/request-password-reset`  | Email a reset link                        |
| POST   | `/api/auth/reset-password`          | Set a new password with the token         |
| POST   | `/api/auth/send-verification-email` | Resend verification                       |

With the bearer plugin, sign-in responses also return the token in the `set-auth-token`
header; the Expo client stores it in `expo-secure-store`.

---

## 2. Errors

Every error, from every endpoint, has this shape and the matching HTTP status:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Only moderators can approve recitations.",
    "details": {}
  }
}
```

`message` is English text for logs and developers; clients choose what to display from `code`.
Clients must treat an unknown `code` as a generic error for its HTTP status.

| Code                       | HTTP | When                                                                                  |
| -------------------------- | ---- | ------------------------------------------------------------------------------------- |
| `VALIDATION_ERROR`         | 400  | Params, query or body failed the schema. `details.issues[]` has `path` and `message`. |
| `UNAUTHENTICATED`          | 401  | No valid cookie or Bearer token                                                       |
| `FORBIDDEN`                | 403  | Signed in but not allowed (role or ownership)                                         |
| `RECITER_PROFILE_REQUIRED` | 403  | Upload attempted before the first switch to reciter mode                              |
| `REAUTH_REQUIRED`          | 403  | Account deletion needs a session from the last 24 hours                               |
| `QUOTA_EXCEEDED`           | 403  | Storage quota or playlist limit reached                                               |
| `NOT_FOUND`                | 404  | Missing, or not visible to the caller (pending items for non-owners)                  |
| `CONFLICT`                 | 409  | Invalid state transition, token reused, concurrent moderation                         |
| `ALREADY_REPORTED`         | 409  | Caller already has an open report on this recitation                                  |
| `UPLOAD_EXPIRED`           | 410  | Upload token expired                                                                  |
| `FILE_TOO_LARGE`           | 413  | Over 60 MB                                                                            |
| `UNSUPPORTED_MEDIA_TYPE`   | 415  | Not audio/mpeg, audio/mp4, audio/ogg or audio/webm                                    |
| `INVALID_AYAH_RANGE`       | 422  | Ayah range does not exist in that surah                                               |
| `UPLOAD_NOT_FOUND`         | 422  | Confirm called but no file is in storage                                              |
| `UPLOAD_MISMATCH`          | 422  | Stored file's size or type differs from the presign request                           |
| `RATE_LIMITED`             | 429  | `details.retryAfterSec`; the `Retry-After` header is also set                         |
| `INTERNAL_ERROR`           | 500  | Unexpected; logged server-side                                                        |
| `SERVICE_UNAVAILABLE`      | 503  | Database unreachable (health check)                                                   |

---

## 3. Pagination

Cursor-based: `?cursor=<opaque>&limit=20` (1–50, default 20). Responses are
`{ "items": [...], "nextCursor": "<opaque>" | null }`. Pass `nextCursor` back unchanged with
the same filters and sort; a cursor reused with different filters returns `VALIDATION_ERROR`.
With `sort=newest`, pages are stable even when new items are added.

---

## 4. Rate limits

Per signed-in user, or per hashed IP when anonymous. Exceeding one returns `429 RATE_LIMITED`.

| Policy   | Limit      | Endpoints                                                                         |
| -------- | ---------- | --------------------------------------------------------------------------------- |
| `upload` | 20 / hour  | `POST /uploads/presign`, `POST /recitations`                                      |
| `like`   | 300 / hour | `POST`/`DELETE /recitations/{id}/like`                                            |
| `report` | 20 / day   | `POST /recitations/{id}/report`                                                   |
| `play`   | 600 / hour | `POST /recitations/{id}/play` (plus once-per-6-hours de-duplication per listener) |
| `write`  | 120 / hour | every other `POST`/`PUT`/`PATCH`/`DELETE`                                         |

The OpenAPI document repeats these per operation as `x-rate-limit`.

---

## 5. Caching

Public lists and profiles are CDN-cached for 60 s **only for anonymous requests**; the surah
list and text are cached for a day. Anything personal is `private, no-store`. The policy per
operation is in OpenAPI as `x-cache`.

---

## 6. Versioning

`/api/v1` is permanent for installed apps. New endpoints and new optional fields are added in
place (minor version bump of `info.version`). Removing, renaming or retyping anything means
`/api/v2`. CI fails if `openapi.json` changes without a version bump. Details:
[ARCHITECTURE.md §10](ARCHITECTURE.md#10-api-versioning).

---

## 7. Endpoints

† = added beyond the original spec (ARCHITECTURE D6).

### Health

| Method | Path      | Auth   | Success | Response                                                       |
| ------ | --------- | ------ | ------- | -------------------------------------------------------------- |
| GET    | `/health` | public | 200     | `HealthResponse` (503 `SERVICE_UNAVAILABLE` if the DB is down) |

### Surahs

| Method | Path               | Auth | Query                               | Response                                                                               |
| ------ | ------------------ | ---- | ----------------------------------- | -------------------------------------------------------------------------------------- |
| GET    | `/surahs`          | user | —                                   | `{ items: SurahSummary[114] }`                                                         |
| GET    | `/surahs/{n}`      | user | `sort` (default `popular`), `limit` | `{ surah, recitations: RecitationPage }`                                               |
| GET    | `/surahs/{n}/text` | user | —                                   | `{ surah, bismillah, ayahs: [{ number, text, words: [{ position, text }] }], source }` |

`SurahSummary` = `number, nameArabic, nameTransliterated, nameEnglish, ayahCount,
revelationPlace (meccan|medinan), revelationOrder, juz[]`. `source` carries the Tanzil
attribution and the text checksum; clients must display the attribution.

### Recitations

| Method | Path                       | Auth             | Body                   | Success | Response                    |
| ------ | -------------------------- | ---------------- | ---------------------- | ------- | --------------------------- |
| GET    | `/recitations`             | user             | —                      | 200     | `RecitationPage`            |
| GET    | `/recitations/{id}`        | user             | —                      | 200     | `RecitationDetail`          |
| POST   | `/recitations/{id}/play`   | user             | —                      | 200     | `{ counted, playCount }`    |
| POST   | `/recitations`             | user             | `CreateRecitationBody` | 201     | `RecitationDetail`          |
| PATCH  | `/recitations/{id}`        | owner, moderator | `UpdateRecitationBody` | 200     | `RecitationDetail`          |
| DELETE | `/recitations/{id}`        | owner, moderator | —                      | 204     | —                           |
| POST   | `/recitations/{id}/like`   | user             | —                      | 200     | `{ liked, likeCount }`      |
| DELETE | `/recitations/{id}/like`   | user             | —                      | 200     | `{ liked, likeCount }`      |
| POST   | `/recitations/{id}/report` | user             | `{ reason, note? }`    | 201     | `{ id, status, createdAt }` |

`GET /recitations` query: `surah`, `reciterId`, `style`, `riwayah`,
`sort = newest | popular | trending†` (default `newest`), `cursor`, `limit`. Only approved items.

`Recitation` = `id, surah, ayahFrom, ayahTo, title, riwayah, style, durationSec, status,
playCount, likeCount, createdAt, reciter { id, name, image, country, verifiedReciter },
stream { url, expiresAt, contentType }, viewer { liked, isOwner } | null`.
`RecitationDetail` adds `sizeBytes` and `moderationNote` (null unless owner or moderator).

Notes:

- Pending, rejected and removed recitations return 404 except to the uploader and moderators.
- `stream.url` is a signed URL; when `expiresAt` has passed, fetch the recitation again.
- Like and unlike are idempotent: liking twice keeps `likeCount` unchanged.
- `reason` is `wrong_surah | recitation_mistake | not_quran | copyright | other`; `note` is
  required for `other`.
- Edits: a non-verified owner who changes `surah`, `ayahFrom`, `ayahTo` or `riwayah` of an
  approved recitation sends it back to `pending` (D9).

### Uploads

| Method | Path               | Auth | Body                | Success | Response                |
| ------ | ------------------ | ---- | ------------------- | ------- | ----------------------- |
| POST   | `/uploads/presign` | user | `PresignUploadBody` | 200     | `PresignUploadResponse` |

Requires the reciter profile to be on (`RECITER_PROFILE_REQUIRED` otherwise) and stays within
the storage quota (300 MB, or 2 GB for verified reciters). Full flow:

```http
POST /api/v1/uploads/presign
{ "surah": 112, "ayahFrom": 1, "ayahTo": 4, "contentType": "audio/mpeg",
  "sizeBytes": 2483120, "rightsConfirmed": true }

200 { "uploadUrl": "https://<account>.r2.cloudflarestorage.com/tilawah-audio/incoming/…?X-Amz-…",
      "method": "PUT", "headers": { "Content-Type": "audio/mpeg" },
      "uploadToken": "eyJ2IjoxLCJ1c2VySWQiOi…", "expiresAt": "2026-11-12T08:40:00.000Z" }

PUT <uploadUrl>            (raw file bytes, the headers above; XHR for progress)

POST /api/v1/recitations
{ "uploadToken": "eyJ2IjoxLCJ1c2VySWQiOi…", "title": "Surat al-Ikhlas",
  "style": "murattal", "riwayah": "hafs", "durationSec": 31.4 }

201 { "id": "…", "status": "pending", … }      // "approved" for verified reciters
```

Error mapping for each failure is in [ARCHITECTURE.md §6](ARCHITECTURE.md#6-audio-storage-and-upload-flow).

### Reciters

| Method | Path             | Auth | Query                     | Response                                   |
| ------ | ---------------- | ---- | ------------------------- | ------------------------------------------ |
| GET    | `/reciters` †    | user | `cursor`, `limit`         | `ReciterPage` (verified reciters)          |
| GET    | `/reciters/{id}` | user | `sort`, `cursor`, `limit` | `{ reciter: ReciterProfile, recitations }` |

A profile is visible once the user has turned on reciter mode (`reciterSince` set); anyone
else is 404, so listener-only accounts are never exposed.

### Playlists

| Method | Path                | Auth  | Body                                   | Success | Response                          |
| ------ | ------------------- | ----- | -------------------------------------- | ------- | --------------------------------- |
| GET    | `/playlists`        | user  | —                                      | 200     | `PlaylistPage` (own)              |
| POST   | `/playlists`        | user  | `{ name, isPublic?, recitationIds? }`  | 201     | `Playlist`                        |
| GET    | `/playlists/{id}` † | user  | —                                      | 200     | `PlaylistDetail` (public, or own) |
| PATCH  | `/playlists/{id}` † | owner | `{ name?, isPublic?, recitationIds? }` | 200     | `Playlist`                        |
| DELETE | `/playlists/{id}` † | owner | —                                      | 204     | —                                 |

`recitationIds` is ordered, unique, max 200, and replaces the whole list on PATCH. Max 100
playlists per user (`QUOTA_EXCEEDED`). Recitations that are no longer approved are left out
of `PlaylistDetail`.

### Me

| Method | Path                  | Auth                      | Body / query                    | Response                                                 |
| ------ | --------------------- | ------------------------- | ------------------------------- | -------------------------------------------------------- |
| GET    | `/me` †               | user                      | —                               | `UserAccount`                                            |
| PATCH  | `/me` †               | user                      | `{ name?, bio?, country? }`     | `UserAccount`                                            |
| PUT    | `/me/mode` †          | user                      | `{ mode: listener \| reciter }` | `UserAccount`                                            |
| DELETE | `/me` †               | user                      | —                               | 204                                                      |
| GET    | `/me/reciter/stats` † | user (reciter profile on) | —                               | `ReciterStats`                                           |
| GET    | `/me/library`         | user                      | `cursor`, `limit` (for likes)   | `{ likes: RecitationPage, playlists: Playlist[] }`       |
| GET    | `/me/recitations` †   | user                      | `status?`, `cursor`, `limit`    | `MyRecitationPage` (all statuses, with `moderationNote`) |

`UserAccount` = `id, name, email, emailVerified, image, role, mode, reciterSince,
verifiedReciter, bio, country, createdAt`. Email, password and avatar changes go through
Better Auth.

`ReciterStats` = `recitations { pending, approved, rejected }, totalPlays, totalLikes,
playsLast7Days, storage { usedBytes, quotaBytes }` for the reciter dashboard.

`DELETE /me` needs a session created in the last 24 hours (`REAUTH_REQUIRED` otherwise),
deletes the user, sessions, likes and playlists, and marks the user's
recitations removed with their audio deleted. The last remaining admin cannot delete their
account (`CONFLICT`).

### Moderation

| Method | Path                                    | Auth      | Body                                                                                                       | Response                  |
| ------ | --------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------- | ------------------------- |
| GET    | `/moderation/queue`                     | moderator | query `kind = recitations \| reports`, `cursor`, `limit`                                                   | `ModerationQueueResponse` |
| POST   | `/moderation/recitations/{id}/decision` | moderator | `{ decision: approve }` · `{ decision: reject, reason }` · `{ decision: remove, reason, resolveReports? }` | `RecitationDetail`        |
| POST   | `/moderation/reports/{id}/decision` †   | moderator | `{ decision: actioned \| dismissed, note? }`                                                               | `Report`                  |

Queue items are oldest first and include a signed stream URL for the inline player and the
open report count. Both kinds return `counts { pendingRecitations, openReports }`.
Transitions: approve `pending|rejected → approved`, reject `pending → rejected`, remove
`pending|approved → removed`; anything else is `CONFLICT`.

### Admin †

| Method | Path                | Auth  | Body / query                  | Response                       |
| ------ | ------------------- | ----- | ----------------------------- | ------------------------------ |
| GET    | `/admin/users`      | admin | `email` (exact)               | `{ items: UserAccount[0..1] }` |
| PATCH  | `/admin/users/{id}` | admin | `{ role?, verifiedReciter? }` | `UserAccount`                  |

`role` is `user | moderator | admin`. Setting `verifiedReciter: true` also turns on the
user's reciter profile if it was off. Admins cannot change their own role (`CONFLICT`), so the
last admin cannot lock themselves out.
