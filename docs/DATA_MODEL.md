# Tilawah — Data model

MongoDB Atlas M0 (512 MB, counted as **uncompressed BSON + index bytes**). Mongoose models and
index definitions live in `packages/db` (Phase 2); only `packages/core` repositories use them.

Conventions:

- `_id` is an ObjectId; the API exposes it as `id` (24 lowercase hex chars).
- `createdAt` / `updatedAt` are set by Mongoose timestamps, stored as BSON dates, serialized
  as ISO 8601 UTC strings.
- **No audio and no Quran text in MongoDB.** Audio is in R2 (`audioKey` only); text ships in
  `packages/quran-data`.
- Fields marked † were added beyond the original spec (approved in review, ARCHITECTURE D7).
- A user's public reciter page is served from `users` (name, image, country, bio,
  `reciterSince`, `verifiedReciter`); there is no separate reciter collection, because a
  reciter is just a user who has turned on reciter mode.
- Every index below is justified by a named query. Compound indexes end with the sort key and
  `_id`, which is what makes keyset (cursor) pagination stable when new items arrive.

---

## 1. Application collections

### `users` (owned by Better Auth, extended)

Better Auth's user model is renamed to `users` and given additional fields.

| Field                      | Type                         | Notes                                                                                |
| -------------------------- | ---------------------------- | ------------------------------------------------------------------------------------ |
| `name`                     | string ≤ 80                  |                                                                                      |
| `email`                    | string                       | lowercase; returned only to the user and admins                                      |
| `emailVerified` †          | boolean                      | Better Auth core field                                                               |
| `image`                    | string (URL) \| null         | from Google, or null                                                                 |
| `role`                     | `user \| moderator \| admin` | staff permissions; default `user`; not user-settable (D8)                            |
| `mode` †                   | `listener \| reciter`        | default `listener`; switched by the user with `PUT /me/mode`                         |
| `reciterSince` †           | date \| null                 | set on the first switch to reciter; public profile exists iff set; not user-settable |
| `verifiedReciter`          | boolean                      | badge granted by staff; uploads skip review; not user-settable                       |
| `bio`                      | string ≤ 500 \| null         |                                                                                      |
| `country`                  | ISO 3166-1 alpha-2 \| null   |                                                                                      |
| `createdAt`, `updatedAt` † | date                         |                                                                                      |

| Index                                                            | Serves                             |
| ---------------------------------------------------------------- | ---------------------------------- |
| `{ email: 1 }` unique                                            | sign-in, `GET /admin/users?email=` |
| `{ verifiedReciter: 1, _id: 1 }` partial `verifiedReciter: true` | `GET /reciters`                    |

### `recitations`

| Field                            | Type                                         | Notes                                                                   |
| -------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------- |
| `uploaderId`                     | ObjectId → users                             |                                                                         |
| `surah`                          | int 1–114                                    |                                                                         |
| `ayahFrom`, `ayahTo`             | int                                          | `1 ≤ ayahFrom ≤ ayahTo ≤ ayahCount(surah)` (checked against quran-data) |
| `title`                          | string ≤ 120                                 |                                                                         |
| `riwayah`                        | enum of 20 ids, default `hafs`               | D10                                                                     |
| `style`                          | `murattal \| mujawwad \| teaching`           |                                                                         |
| `audioKey`                       | string                                       | `audio/{_id}.{ext}` in R2                                               |
| `audioContentType` †             | one of the 4 allowed audio types             | needed to sign GET URLs and for the player                              |
| `durationSec`                    | number                                       | reported by the client, sanity-checked against size                     |
| `sizeBytes`                      | int                                          | from the R2 HEAD response, not the client                               |
| `status`                         | `pending \| approved \| rejected \| removed` |                                                                         |
| `playCount`, `likeCount`         | int ≥ 0                                      | denormalized counters (§3)                                              |
| `rightsConfirmedAt` †            | date                                         | when the uploader ticked the permission box                             |
| `moderationNote` †               | string \| null                               | reason for reject/remove; shown to the uploader                         |
| `moderatedBy` †, `moderatedAt` † | ObjectId \| null, date \| null               | audit trail                                                             |
| `createdAt`, `updatedAt`         | date                                         |                                                                         |

| Index                                                  | Serves                                                                                          |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `{ status: 1, surah: 1, createdAt: -1, _id: -1 }`      | surah page / `?surah=` sorted newest (spec: `{status, surah}`)                                  |
| `{ status: 1, surah: 1, playCount: -1, _id: -1 }`      | surah page / `?surah=` sorted popular                                                           |
| `{ status: 1, playCount: -1, _id: -1 }`                | global popular (spec)                                                                           |
| `{ status: 1, createdAt: -1, _id: -1 }`                | global newest (spec); moderation queue (same index, ascending)                                  |
| `{ uploaderId: 1, status: 1, createdAt: -1, _id: -1 }` | reciter profile, `GET /me/recitations`, reciter stats, storage quota sum (spec: `{uploaderId}`) |
| `{ audioKey: 1 }` unique                               | an upload token can be confirmed only once                                                      |

`style` and `riwayah` filters are applied after the index scan; at the expected volume this
is cheaper than six more indexes.

**Status transitions** (enforced in `RecitationService`):

```
upload (normal user)  ──▶ pending ──approve──▶ approved ──remove──▶ removed
upload (verified)     ─────────────────────────▲   │
                          pending ──reject──▶ rejected ──approve──▶ approved
                          pending ──remove──▶ removed
owner edit of surah/range/riwayah on approved (non-verified owner) ──▶ pending   (D9)
owner delete (any status) ──▶ removed
```

Visibility: `approved` to everyone; every other status only to the uploader and moderators.

### `likes`

| Field          | Type                   |
| -------------- | ---------------------- |
| `userId`       | ObjectId → users       |
| `recitationId` | ObjectId → recitations |
| `createdAt`    | date                   |

| Index                                   | Serves                                                             |
| --------------------------------------- | ------------------------------------------------------------------ |
| `{ userId: 1, recitationId: 1 }` unique | idempotent like; `viewer.liked` lookups for a page of items (spec) |
| `{ userId: 1, createdAt: -1, _id: -1 }` | `GET /me/library` liked list, most recent first                    |

### `playlists`

| Field                      | Type                              | Notes |
| -------------------------- | --------------------------------- | ----- |
| `ownerId`                  | ObjectId → users                  |       |
| `name`                     | string ≤ 80                       |       |
| `recitationIds`            | ObjectId[] ≤ 200, ordered, unique |       |
| `isPublic`                 | boolean, default false            |       |
| `createdAt`, `updatedAt` † | date                              |       |

| Index                                    | Serves                                        |
| ---------------------------------------- | --------------------------------------------- |
| `{ ownerId: 1, updatedAt: -1, _id: -1 }` | `GET /playlists`, library (spec: `{ownerId}`) |

Max 100 playlists per user.

### `reports`

| Field          | Type                                                                   | Notes                |
| -------------- | ---------------------------------------------------------------------- | -------------------- |
| `recitationId` | ObjectId → recitations                                                 |                      |
| `reporterId`   | ObjectId → users                                                       |                      |
| `reason`       | `wrong_surah \| recitation_mistake \| not_quran \| copyright \| other` |                      |
| `note`         | string ≤ 1000 \| null                                                  | required for `other` |
| `status`       | `open \| actioned \| dismissed`                                        |                      |
| `resolution` † | `{ note, decidedAt, decidedBy }` \| null                               | audit trail          |
| `createdAt`    | date                                                                   |                      |

| Index                                                                 | Serves                                                                 |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `{ status: 1, createdAt: 1, _id: 1 }`                                 | moderation queue, oldest first (spec: `{status}`)                      |
| `{ recitationId: 1, status: 1 }`                                      | open-report count per item; resolve on remove (spec: `{recitationId}`) |
| `{ recitationId: 1, reporterId: 1 }` unique, partial `status: "open"` | `ALREADY_REPORTED`                                                     |

### `memorizationSessions`

| Field                         | Type                                              | Notes                               |
| ----------------------------- | ------------------------------------------------- | ----------------------------------- |
| `userId`                      | ObjectId → users                                  |                                     |
| `surah`, `ayahFrom`, `ayahTo` | int                                               |                                     |
| `mode` †                      | `reveal \| check_ayah \| listen_repeat`           |                                     |
| `wordsTotal`                  | int                                               | must equal the range's word count   |
| `wordsCorrect`                | int ≤ wordsTotal                                  |                                     |
| `mistakes`                    | `{ ayah, word, type: missed \| hinted }[]` ≤ 2000 | positions only, never what was said |
| `startedAt`, `endedAt`        | date                                              |                                     |

| Index                         | Serves                   |
| ----------------------------- | ------------------------ |
| `{ userId: 1, surah: 1 }`     | per-surah history (spec) |
| `{ endedAt: 1 }` TTL 365 days | retention (D12)          |

### `memorizationProgress`

| Field             | Type       | Notes                                           |
| ----------------- | ---------- | ----------------------------------------------- |
| `userId`          | ObjectId   |                                                 |
| `surah`           | int        |                                                 |
| `lastAyah`        | int        | highest `ayahTo` reached in any session         |
| `bestAccuracy`    | number 0–1 | best `wordsCorrect / wordsTotal` for this surah |
| `lastPracticedAt` | date       |                                                 |

| Index                            | Serves                                       |
| -------------------------------- | -------------------------------------------- |
| `{ userId: 1, surah: 1 }` unique | upsert on session save; progress list (spec) |

Updated in the same transaction as the session insert.

---

## 2. Operational collections

| Collection         | Owner       | Fields                                                                 | Indexes                                                                      |
| ------------------ | ----------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `sessions` †       | Better Auth | `token`, `userId`, `expiresAt`, `ipAddress`\*, `userAgent`\*           | `{ token: 1 }` unique, `{ userId: 1 }`, `{ expiresAt: 1 }` TTL 0             |
| `accounts` †       | Better Auth | `userId`, `providerId`, `accountId`, hashed `password` or OAuth tokens | `{ userId: 1 }`, `{ providerId: 1, accountId: 1 }` unique                    |
| `verifications` †  | Better Auth | `identifier`, `value`, `expiresAt`                                     | `{ identifier: 1 }`, `{ expiresAt: 1 }` TTL 0                                |
| `rateLimits` †     | core        | `_id: "policy:subject:windowStart"`, `count`, `expiresAt`              | `{ expiresAt: 1 }` TTL 0                                                     |
| `playStatsDaily` † | core        | `recitationId`, `day` (`YYYY-MM-DD`), `plays`, `expiresAt`             | `{ recitationId: 1, day: 1 }` unique, `{ day: 1 }`, `{ expiresAt: 1 }` TTL 0 |

\* Better Auth stores IP and user agent on sessions by default. **We disable both**
(`advanced.ipAddress.disableIpTracking`, and omit user agent) to collect only what the model
lists. Better Auth's own sign-in rate limiter keys on the client IP, so it is given a
`customStorage` that HMACs the key and stores it in `rateLimits`; it gets no collection of
its own.

Play de-duplication markers live in `rateLimits` with `_id: "play:{recitationId}:{listener}"`
and a 6-hour expiry, where `listener` is the user id or `HMAC(IP_HASH_SECRET, ip)`.

---

## 3. Consistency rules

- **Likes**: like = insert into `likes` (unique index) and `$inc likeCount: 1` in one
  transaction; a duplicate-key error means "already liked" and changes nothing. Unlike =
  `deleteOne`, and only if it deleted a document, `$inc likeCount: -1`. Atlas M0 is a 3-node
  replica set, so multi-document transactions are available (tests use
  `MongoMemoryReplSet`).
- **Plays**: `$inc playCount` and upsert of the day bucket are not in a transaction; a lost
  increment on a crash is acceptable for a popularity counter.
- **Moderation decisions** update the recitation and resolve its open reports in one
  transaction, guarded by the expected current status (`findOneAndUpdate({ _id, status })`),
  so two moderators cannot both act on the same item.
- **Removal** sets `status: removed`, then deletes the R2 object. If the delete fails, the key
  is retried by the next removal pass (Phase 2: a small `pnpm --filter db sweep` script, run
  manually or from a scheduled GitHub Action, also deletes rejected audio after 7 days per D4).
- **Cursors** encode `{ sort, filtersHash, lastSortValue, lastId }` as base64url. A cursor
  used with different filters is a `VALIDATION_ERROR`. For `popular` and `trending`, counts
  can change between pages, so an item may rarely repeat or be skipped; `newest` is fully
  stable.

---

## 4. Size budget (512 MB cap)

Estimate at **10,000 users, 5,000 recitations, 200,000 likes, 100,000 memorization sessions
per year**, uncompressed, including indexes:

| Collection                  | Docs    | ≈ Size       |
| --------------------------- | ------- | ------------ |
| users + sessions + accounts | 30k     | 12 MB        |
| recitations                 | 5k      | 5 MB         |
| likes                       | 200k    | 35 MB        |
| playlists                   | 2k      | 5 MB         |
| reports                     | 1k      | < 1 MB       |
| memorizationSessions (1 yr) | 100k    | 45 MB        |
| memorizationProgress        | 50k     | 7 MB         |
| rateLimits + playStatsDaily | rolling | 5 MB         |
| **Total**                   |         | **≈ 115 MB** |

Headroom is ~4×. The fastest-growing items are likes and sessions; the session TTL (D12) caps
the latter. Phase 2 adds a `pnpm --filter db stats` script that prints `dbStats` so the
real number can be checked against this table.
