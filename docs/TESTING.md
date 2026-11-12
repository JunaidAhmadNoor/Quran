# Tilawah — Testing

Every layer runs with `pnpm test` from the repository root, and in GitHub Actions on every pull
request. **No test touches a real database, real R2, or the network.** The one exception is
infrastructure, not a test: the first run downloads the MongoDB 8.0 binary used by the
in-memory database (cached afterwards, also in CI).

## Layers

| Layer                            | Tool                           | Where                           | Run alone                                |
| -------------------------------- | ------------------------------ | ------------------------------- | ---------------------------------------- |
| Contract                         | Vitest + Zod                   | `packages/contracts/test`       | `pnpm --filter @tilawah/contracts test`  |
| Quran data integrity             | Vitest                         | `packages/quran-data/test`      | `pnpm --filter @tilawah/quran-data test` |
| Normalization + matcher (unit)   | Vitest                         | `packages/recitation/test`      | `pnpm --filter @tilawah/recitation test` |
| Database indexes                 | Vitest + mongodb-memory-server | `packages/db/test`              | `pnpm --filter @tilawah/db test`         |
| Services and rules               | Vitest + mongodb-memory-server | `packages/core/test`            | `pnpm --filter @tilawah/core test`       |
| R2                               | aws-sdk-client-mock            | `packages/core/test/r2.test.ts` | (part of core)                           |
| API route handlers (integration) | Vitest + mongodb-memory-server | `apps/web/test`                 | `pnpm --filter @tilawah/web test`        |
| Components, E2E, accessibility   | RTL + MSW, Playwright, axe     | Phase 3                         | —                                        |

Run one file: `pnpm --filter @tilawah/core exec vitest run test/uploads.test.ts`.
Watch mode: `pnpm --filter @tilawah/core exec vitest`.

## What each layer proves

**Contracts (39 tests).** Every endpoint in the registry has a matching path-param schema, a
response schema (except 204), a rate limit on writes, and no shared caching for personal data.
`openapi.json` matches the Zod schemas exactly and carries the package version. Key schema
rules (rights confirmation, ayah order, PATCH not empty, mode values, role not user-settable).

**Quran data (19 tests).** SHA-256 of both Tanzil files matches `checksums.json`; the copyright
block is intact; 114 surahs and 6,236 ayahs; the generated files are up to date; joining the
generated words reproduces every source line byte-for-byte (so the derivation changes
nothing); the bismillah split keeps each surah's own spelling (95 and 97 carry a shadda).

**Recitation (63 tests, 98% lines).** 42 table-driven normalization cases (harakat, tatweel,
alef forms, ة/ه, ى/ي, hamza carriers, Uthmani small waw/yeh, pause marks, Farsi letters,
punctuation). The matcher against the real Tanzil text: exact match, small pronunciation
differences, too-different words rejected, skipped word marked missed, window of 3, repeated
words and isti'adha ignored, the bismillah said before a surah ignored, أعوذ still matched when
it is the expected word, wrong ayah detected (inside the range and in the wider surah), hints at
6 s and 12 s with a fake clock, hinted words recorded, completion and summary.

**Database (4 tests).** Unique indexes the rules depend on, TTL indexes, duplicate likes
rejected, transactions available.

**Core (77 tests, 98.6% lines).** Every rule, through the real services and MongoDB:

- Permissions: a listener cannot approve; a user cannot edit another user's recitation;
  moderators can; pending uploads are hidden from public lists but visible to the uploader and
  moderators; moderation note and size only for owner and staff.
- Uploads: wrong type → `UNSUPPORTED_MEDIA_TYPE`, too large → `FILE_TOO_LARGE`, expired
  token → `UPLOAD_EXPIRED`, nothing in R2 → `UPLOAD_NOT_FOUND`, wrong size → `UPLOAD_MISMATCH`,
  token reuse → `CONFLICT`, another user's token, impossible duration, quota, reciter profile.
- Verified reciters skip the queue; switching to reciter mode does not.
- Likes: liking twice does not double-count; unlike decrements; idempotent both ways.
- Pagination: cursors stay stable when new items arrive; ties on equal timestamps neither skip
  nor repeat; a cursor reused with other filters is rejected.
- Plays (once per listener per 6 h), trending (7 days), reports (one open per user), edits
  sending approved recitations back to review, removal and audio deletion with retry,
  moderation transitions and report resolution, admin rules, mode switching, reciter stats,
  library, playlists, account deletion, memorization checked against the real word count,
  rate limiter windows, maintenance purge, health.

**API integration (66 tests).** Through the **real generated route files**:

- Every endpoint is called at least once (a test fails if one is missing), and `route()`
  validates every success response against its contract schema in test mode, so each call is
  also a contract test.
- HTTP behaviour: 401 envelope, 403 for wrong roles, 400 with `details.issues`, upload error
  statuses (413, 415, 422), 204 deletes, CSRF block for cookie writes from other origins,
  429 with `Retry-After`, cache headers (shared only when anonymous), CORS only for allowed
  origins, raw IPs never stored.
- **Real Better Auth** (`auth.test.ts`): sign-up creates users with Tilawah defaults; the same
  endpoints accept the mobile Bearer token and the web cookie; switching mode needs no new
  session; sessions store no IP address or user agent; sign-up cannot set a role.
- The spec's main story at API level (`flow.test.ts`): listener switches to reciter → uploads
  → hidden until approved → moderator approves → appears on the surah page → another user
  plays and likes → reciter dashboard updates.

Auth in the other integration tests is faked by the harness: `Authorization: Bearer
test:<userId>` signs in as that user (`apps/web/test/harness.ts`).

## Coverage gates

`packages/core` and `packages/recitation` fail their test run below 80% line coverage
(`vitest.config.ts`). Current: core 98.6%, recitation 98.4%. Reports: `packages/*/coverage/`.

## CI (`.github/workflows/ci.yml`)

install → format check → lint → typecheck → `check:openapi` → API version bump (PRs) →
breaking-change check with oasdiff (PRs, once `API_RELEASED=true`) → all tests with coverage →
build → coverage artifact. Phase 3 adds Playwright and axe, uploading the Playwright report on
failure.

## Check your environment file

```sh
pnpm --filter @tilawah/web env:check
```

Validates `apps/web/.env.local` and lists which features are on (Google, R2, email). It prints
variable names only, never values.

## Seed data for local development

```sh
pnpm --filter @tilawah/web seed        # reads apps/web/.env.local
```

Creates `listener@`, `reciter@`, `verified@`, `moderator@` and `admin@tilawah.dev` (password
`tilawah-demo-123`, or `SEED_PASSWORD`) and seven sample recitations (approved, pending and
rejected). Set `SEED_AUDIO_FILE=/path/to/file.mp3` to upload a real audio file to R2 for them.
Safe to run repeatedly; refuses to run with `NODE_ENV=production`.
