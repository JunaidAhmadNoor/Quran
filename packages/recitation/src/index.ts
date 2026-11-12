export { normalizeArabic, normalizeWords } from './normalize';
export { levenshtein, similarity } from './similarity';
export {
  RecitationMatcher,
  expectedWordsFrom,
  type ExpectedWord,
  type MatcherEvent,
  type MatcherOptions,
  type MatcherSummary,
  type WordState,
} from './matcher';
export { FakeEngine, type FakeEngineOptions, type RecognitionEngine } from './engine';
export { AudioChunker, rms, type ChunkInfo, type ChunkerOptions } from './chunker';
export { ECHO_MAX_SEC, dropOverlap, freshWords } from './stitch';
