import { normalizeArabic } from './normalize';
import { similarity } from './similarity';

/**
 * Overlapping chunks make the recognizer hear boundary words twice. Removes the longest prefix of
 * `next` that repeats the end of `previous` (up to `maxOverlap` words), comparing normalized text.
 */
export function dropOverlap(
  previous: readonly string[],
  next: readonly string[],
  maxOverlap = 4,
): string[] {
  const a = previous.map((w) => normalizeArabic(w));
  const b = next.map((w) => normalizeArabic(w));
  for (let k = Math.min(maxOverlap, a.length, b.length); k > 0; k--) {
    const tail = a.slice(a.length - k);
    if (tail.every((w, i) => w !== '' && w === b[i])) return next.slice(k);
  }
  return [...next];
}

/** Segments shorter than this are often a room echo of the last word, transcribed again. */
export const ECHO_MAX_SEC = 2.5;

/**
 * Words of a new segment that were not already heard. A segment cut mid-speech (overlapped) drops
 * the words repeating the previous segment's end. A short segment that is only one word similar to
 * the previous last word is the reverb tail of that phrase ("القدر" comes back as "والقدر") and is
 * dropped: otherwise it can match the same word further on and skip the words before it. Anything
 * else after a pause is taken as is, so a deliberate repetition counts.
 */
export function freshWords(
  previous: readonly string[],
  next: readonly string[],
  segment: { overlapped: boolean; durationSec: number },
): string[] {
  if (segment.overlapped) return dropOverlap(previous, next);
  const last = previous.at(-1);
  const only = next.length === 1 ? next[0] : undefined;
  if (
    segment.durationSec < ECHO_MAX_SEC &&
    last !== undefined &&
    only !== undefined &&
    similarity(normalizeArabic(last), normalizeArabic(only)) >= 0.8
  )
    return [];
  return [...next];
}
