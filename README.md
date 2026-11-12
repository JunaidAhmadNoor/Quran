# Tilawah (working name)

A Spotify-style platform only for Quran recitations: listen to community recitations of all
114 surahs, upload your own (reviewed before publishing), and practise memorization with
hidden-text word reveal.

**Status: Phase 1 (architecture) complete, awaiting review.** No feature code yet.

| Doc                                                                | What it covers                                                                 |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)                       | System design, layering, auth, uploads, free-tier limits, **decisions needed** |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md)                           | MongoDB collections, indexes, consistency, size budget                         |
| [docs/API.md](docs/API.md)                                         | `/api/v1` conventions and every endpoint                                       |
| [packages/contracts/openapi.json](packages/contracts/openapi.json) | Generated OpenAPI 3.1 spec                                                     |

## Getting started

Requires Node 24 and pnpm 12 (`corepack enable`).

```sh
pnpm install
cp .env.example apps/web/.env.local   # fill in values (not needed for Phase 1 checks)
pnpm dev                              # http://localhost:3000
```

| Script               | Does                                         |
| -------------------- | -------------------------------------------- |
| `pnpm dev`           | Run the web app                              |
| `pnpm build`         | Production build                             |
| `pnpm test`          | All test suites                              |
| `pnpm lint`          | ESLint (strict, type-aware, layering rules)  |
| `pnpm typecheck`     | `tsc --noEmit` in every package              |
| `pnpm format`        | Prettier                                     |
| `pnpm openapi`       | Regenerate `packages/contracts/openapi.json` |
| `pnpm check:openapi` | Fail if `openapi.json` is stale (CI)         |

## Quran text

The Quran text comes only from the verified [Tanzil](https://tanzil.net) Uthmani file and is
protected by a checksum test. It is never edited, generated or retyped.
