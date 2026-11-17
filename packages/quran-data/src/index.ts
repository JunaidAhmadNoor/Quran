// Runtime access to the verified Quran text and surah metadata. Works in Node, browsers and
// React Native: no file-system access, text is loaded per surah through dynamic JSON imports.
import checksums from '../checksums.json' with { type: 'json' };
import { loaders } from '../generated/loaders';
import surahList from '../generated/surahs.json' with { type: 'json' };
import type { SurahMeta, SurahTextFile } from './parse';

export type { SurahMeta } from './parse';

export const SURAH_COUNT = 114;
export const AYAH_COUNT = 6236;

export const surahs: readonly SurahMeta[] = surahList as SurahMeta[];

export const textSource = {
  name: 'Tanzil Quran Text',
  edition: 'Uthmani',
  version: '1.1',
  url: 'https://tanzil.net',
  license:
    'Creative Commons Attribution 3.0. Verbatim copies only; changing the text is not allowed. Source: Tanzil Project (tanzil.net).',
  sha256: checksums.files['quran-uthmani.txt'],
} as const;

export function getSurahMeta(surah: number): SurahMeta | undefined {
  return surahs[surah - 1];
}

/** True when 1 ≤ ayahFrom ≤ ayahTo ≤ the surah's ayah count. */
export function isValidAyahRange(surah: number, ayahFrom: number, ayahTo: number): boolean {
  const meta = getSurahMeta(surah);
  return (
    meta !== undefined &&
    Number.isInteger(ayahFrom) &&
    Number.isInteger(ayahTo) &&
    ayahFrom >= 1 &&
    ayahFrom <= ayahTo &&
    ayahTo <= meta.ayahCount
  );
}

/**
 * Pause marks (ۖ ۗ ۚ …), rub-el-hizb (۞) and sajdah (۩) are standalone tokens in the Tanzil
 * text. They belong to the displayed text but are not words to recite.
 */
export function isWord(token: string): boolean {
  return /\p{L}/u.test(token);
}

export interface Word {
  position: number;
  text: string;
}

export interface Ayah {
  number: number;
  text: string;
  words: Word[];
}

export interface SurahText {
  surah: number;
  bismillah: string | null;
  ayahs: Ayah[];
}

function toAyah(tokens: string[], index: number): Ayah {
  return {
    number: index + 1,
    text: tokens.join(' '),
    words: tokens.filter(isWord).map((text, i) => ({ position: i + 1, text })),
  };
}

const cache = new Map<number, Promise<SurahText>>();

export function loadSurahText(surah: number): Promise<SurahText> {
  const load = loaders[surah];
  if (!load) return Promise.reject(new RangeError(`No surah ${surah}`));
  let pending = cache.get(surah);
  if (!pending) {
    pending = load().then(({ default: file }: { default: SurahTextFile }) => ({
      surah: file.surah,
      bismillah: file.bismillah?.join(' ') ?? null,
      ayahs: file.ayahs.map(toAyah),
    }));
    cache.set(surah, pending);
  }
  return pending;
}

export { normalizeArabic, normalizeWords } from './normalize';
