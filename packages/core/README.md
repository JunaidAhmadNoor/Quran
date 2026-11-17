# @tilawah/core

All business rules live here: who may upload, moderation transitions, play counting, likes,
playlists, hadith. Implemented in **Phase 2**, test-first.

- `services/` take plain inputs (already validated by `@tilawah/contracts`) plus an `Actor`
  (`{ userId, role, verifiedReciter } | null`) and return plain objects or throw a `DomainError`.
- `repositories/` are interfaces plus MongoDB implementations; they are the only code that
  touches the database. Services receive repositories through constructor arguments, so unit
  tests use in-memory fakes and integration tests use `mongodb-memory-server`.
- `errors.ts` defines `DomainError` with a code from `ErrorCode` in `@tilawah/contracts`.
  Route handlers map it to `{ error: { code, message, details } }` and the matching HTTP status.

No imports from `next`, `react`, or anything browser-only. Coverage gate: 80% lines.
