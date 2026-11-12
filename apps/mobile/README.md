# apps/mobile (placeholder)

The Expo (React Native) app for Android and iPhone comes after the website. It will:

- call the same `/api/v1` endpoints through `@tilawah/api-client`, with `auth: { kind: 'bearer' }`;
- sign in with Better Auth's Expo client (`@better-auth/expo`), storing the session token in
  `expo-secure-store` and sending `Authorization: Bearer <token>`;
- reuse `@tilawah/contracts`, `@tilawah/quran-data`, `@tilawah/recitation` and `@tilawah/ui-tokens`;
- implement `RecognitionEngine` with whisper.rn (GGML model) for memorization mode.

Nothing in the backend may change to support it. See docs/ARCHITECTURE.md, "Mobile readiness".
