# @tilawah/db

MongoDB connection, Mongoose models, index definitions, database stats, and
`@tilawah/db/testing` (an in-memory MongoDB 8.0 replica set for tests). See `docs/DATA_MODEL.md`.
The seed script lives in `apps/web/scripts/seed.ts` so it can use Better Auth (see
ARCHITECTURE §19).

Only `packages/core` repositories and the web composition root (`apps/web/server/container.ts`)
may import this package. ESLint enforces it.
