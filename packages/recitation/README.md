# @tilawah/recitation

Pure TypeScript, no DOM or Node APIs, so web and mobile share it.

- **Phase 2:** `normalizeArabic()` (harakat, Quranic marks, tatweel, alef forms, ة/ه, ى/ي)
  with 30+ table-driven tests, and the word matcher (window of 3, normalized Levenshtein
  similarity ≥ 0.8, skipped/repeated/wrong-ayah handling).
- **Phase 4:** the `RecognitionEngine` interface, `FakeEngine` for tests, and the web engine
  (transformers.js in a Web Worker) in `apps/web`. The mobile engine (whisper.rn) implements the
  same interface later.

Coverage gate: 80% lines.
