// Excerpts with the searched words marked. Matching ignores diacritics and letter variants (as the
// server does), but the excerpt keeps the original text, so marks map back to original characters.
const FOLD: Record<string, string> = {
  أ: 'ا',
  إ: 'ا',
  آ: 'ا',
  ٱ: 'ا',
  ة: 'ه',
  ى: 'ي',
  ی: 'ي',
  ک: 'ك',
  ہ: 'ه',
  ھ: 'ه',
};

function fold(text: string): { folded: string; map: number[] } {
  let folded = '';
  const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] ?? '';
    if (/\p{Mn}/u.test(ch) || ch === 'ـ') continue;
    folded += (FOLD[ch] ?? ch).toLowerCase();
    map.push(i);
  }
  return { folded, map };
}

export interface Piece {
  text: string;
  mark: boolean;
}

/** About `radius` characters around the first match, with every match inside it marked. */
export function excerpt(text: string, words: string[], radius = 110): Piece[] | null {
  const { folded, map } = fold(text);
  const ranges: [number, number][] = [];
  for (const w of words) {
    const needle = fold(w).folded;
    if (!needle) continue;
    for (let i = folded.indexOf(needle); i !== -1; i = folded.indexOf(needle, i + needle.length)) {
      let end = (map[i + needle.length - 1] ?? 0) + 1;
      while (end < text.length && /\p{Mn}/u.test(text[end] ?? '')) end++; // its vowel marks too
      ranges.push([map[i] ?? 0, end]);
    }
  }
  if (ranges.length === 0) return null;
  ranges.sort((a, b) => a[0] - b[0]);
  const first = ranges[0]?.[0] ?? 0;
  const start = Math.max(0, text.lastIndexOf(' ', Math.max(0, first - radius)) + 1);
  const endAt = text.indexOf(' ', Math.min(text.length, first + radius * 2));
  const end = endAt === -1 ? text.length : endAt;
  const pieces: Piece[] = [];
  let at = start;
  for (const [a, b] of ranges) {
    if (b <= at || a >= end) continue;
    if (a > at) pieces.push({ text: text.slice(at, a), mark: false });
    pieces.push({ text: text.slice(Math.max(a, at), Math.min(b, end)), mark: true });
    at = Math.min(b, end);
  }
  if (at < end) pieces.push({ text: text.slice(at, end), mark: false });
  if (start > 0) pieces.unshift({ text: '… ', mark: false });
  if (end < text.length) pieces.push({ text: ' …', mark: false });
  return pieces;
}
