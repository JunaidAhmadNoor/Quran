# @tilawah/db

MongoDB connection (cached across serverless invocations), Mongoose models, index
definitions, and the seed script. Implemented in **Phase 2**. See `docs/DATA_MODEL.md`.

Only `packages/core` repositories and the web composition root (`apps/web/server/container.ts`)
may import this package. ESLint enforces it.
