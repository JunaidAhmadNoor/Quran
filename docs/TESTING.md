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

**Design tokens (6 tests).** Every allowed colour pair meets WCAG AA in light and dark; the one
spec pair that fails (light success green on `surface-raised`, 4.22:1) is documented and kept out
of the allowed pairs; no pure black or white; `tokens.css` is generated from the source.

**API client (6 tests).** URLs from path params and query, cookie mode for web, Bearer mode for
mobile, JSON bodies, 204, `ApiError` with the server code and details, non-JSON error pages.

**Components (30 tests).** The player store (queue, next/previous, repeat modes, what happens at
the end of a track) and the player bar (keyboard play/pause, speed menu, repeat, opening the
full-screen view). The upload form: an impossible ayah range shows the designed error, a video
file is refused before anything is sent, and the full path presign → direct XHR PUT to storage
(with the CORS preflight R2 requires) → confirm → "waiting for review", plus the quota message.
The word-reveal component: placeholders keep each word's width, words reveal in order. The UI
messages: Arabic and Urdu have exactly the English keys, every message is valid ICU and the
placeholders match. The recitation list: two lists with the same data source keep separate
caches (regression test for the playlist page once showing liked recitations). The recorder,
with a scripted fake `MediaRecorder`: format choice per browser, start/pause/resume/stop with the
paused time excluded, microphone released after stopping, the 3-second minimum, a blocked
microphone, an unsupported browser, and a recording uploaded with the recorder's duration.

**End-to-end (Playwright, 3 projects).** Against the production build and an isolated stack
(`apps/web/e2e/server.ts`: in-memory MongoDB, local-disk storage in a temp folder, seeded demo
accounts, a real 12-second MP3):

- sign up → switch to reciter mode (no sign-out) → upload the MP3 → not public yet → moderator
  approves → appears on the surah page → another user plays it and likes it;
- the player keeps playing while navigating between pages (position keeps advancing);
- switching to Arabic sets `dir="rtl"` and no element overflows a 375 px screen;
- skip link and keyboard operation of the player;
- switching language mid-playback does not interrupt the audio (regression test);
- a reciter records in the browser (Chromium's fake microphone), previews, and uploads; the
  recitation arrives for review as `audio/webm` with the recorded duration.

**Accessibility (axe, 60 tests).** 15 pages (10 signed out, 5 signed in) × light/dark × LTR
(English)/RTL (Arabic): no serious or critical WCAG 2.1 A/AA violations. One test per page, so a
failure names the page. axe runs on Chromium: its results depend on the DOM, and it occasionally
hung inside WebKit; WebKit and the phone project run every user flow.

Memorization with a scripted fake speech engine is a Phase 4 test.

## Screenshots

`docs/screenshots/` holds every page in light and dark mode (desktop) plus Arabic at phone
width, the player bar and the full-screen player. Regenerate:

```sh
pnpm --filter @tilawah/web build
SCREENSHOTS=1 pnpm --filter @tilawah/web exec playwright test screenshots --project=chromium
```

## Lighthouse

Measured with Lighthouse 13.6 (default mobile emulation, simulated throttling) against the
production build:

| Page                  | Performance | Accessibility | Best practices | SEO | LCP   |
| --------------------- | ----------- | ------------- | -------------- | --- | ----- |
| `/`                   | 99          | 100           | 100            | 100 | 0.8 s |
| `/surahs/1`           | 99          | 100           | 100            | 100 | 0.9 s |
| `/surahs/2`           | 99          | 100           | 100            | 100 | 0.9 s |
| `/surahs`             | 99          | 100           | 100            | 100 | 0.9 s |
| `/surahs/2?view=read` | 78          | 100           | 100            | 100 | 4.7 s |
| `/recitations/{id}`   | 98          | 100           | 100            | 100 | 0.8 s |
| `/reciters/{id}`      | 99          | 100           | 100            | 100 | 0.6 s |
| `/memorize`           | 99          | 100           | 100            | 100 | 0.9 s |

The spec's target (90+ on `/` and `/surahs/[n]`) is met in all four categories. The full reading
view of the longest surah (`?view=read` on Al-Baqarah, 286 ayahs) is the one page below 90 on
performance because the whole text is one document; it could be split into pages of ayahs if
that matters. `/auth/*` pages are `noindex` on purpose.

## Coverage gates

`packages/core` and `packages/recitation` fail their test run below 80% line coverage
(`vitest.config.ts`). Current: core 98.6%, recitation 98.4%. Reports: `packages/*/coverage/`.

## CI (`.github/workflows/ci.yml`)

install → format check → lint → typecheck → `check:openapi` → API version bump (PRs) →
breaking-change check with oasdiff (PRs, once `API_RELEASED=true`) → all tests with coverage →
build → coverage artifact → Playwright (Chromium, WebKit, mobile) with axe → Playwright report
uploaded as an artifact when a test fails.

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
