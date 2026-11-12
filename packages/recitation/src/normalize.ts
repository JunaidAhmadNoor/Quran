// Arabic normalization for comparing what was heard with the expected Quran text.
// Used only for matching; the displayed text is never normalized.

const LETTER_MAP: Record<string, string> = {
  ٱ: 'ا', // ٱ alef wasla → ا
  ة: 'ه', // ة teh marbuta → ه
  ى: 'ي', // ى alef maksura → ي
  ی: 'ي', // ی Farsi yeh → ي
  ک: 'ك', // ک keheh → ك
  ہ: 'ه', // ہ heh goal → ه
};

const ARABIC_LETTER = /[ء-غف-ي]/;

/**
 * Returns bare Arabic letters separated by single spaces:
 * - removes harakat, shadda, sukun, tanween, dagger alef and every Quranic annotation mark;
 * - removes tatweel and the small waw/yeh of the Uthmani script;
 * - unifies alef forms (أ إ آ ٱ → ا) and hamza carriers (ؤ → و, ئ → ي);
 * - treats ة as ه and ى as ي;
 * - turns punctuation, digits, pause signs and anything non-Arabic into word breaks.
 *
 * With `daggerAlef: 'alef'` the dagger alef becomes ا instead (مَـٰلِكِ → مالك, as recognizers
 * write it); the matcher compares against both forms, because some words are written without the
 * alef in standard spelling (هَـٰذَا → هذا).
 */
export function normalizeArabic(
  input: string,
  options: { daggerAlef?: 'drop' | 'alef' } = {},
): string {
  // The dagger alef is a long ā: spoken (and often written in standard spelling) as a full alef.
  if (options.daggerAlef === 'alef') input = input.replace(/\u0670/g, 'ا');
  // NFD splits أ إ آ ؤ ئ into base letter + combining hamza/madda, which the next step drops.
  const decomposed = input.normalize('NFD').replace(/\p{Mn}/gu, '');
  let out = '';
  for (const ch of decomposed) {
    const mapped = LETTER_MAP[ch] ?? ch;
    if (ARABIC_LETTER.test(mapped)) out += mapped;
    else if (mapped === 'ـ' || mapped === 'ۥ' || mapped === 'ۦ') continue;
    else out += ' ';
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** Normalized words of a phrase, empty tokens removed. */
export function normalizeWords(input: string): string[] {
  const normalized = normalizeArabic(input);
  return normalized === '' ? [] : normalized.split(' ');
}
