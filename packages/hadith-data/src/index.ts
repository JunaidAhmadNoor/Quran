// Runtime access to Sahih al-Bukhari and Sahih Muslim. Chapters load on demand through dynamic
// JSON imports (Node, browsers, bundlers); nothing reads the file system.
import bukhariMeta from '../generated/bukhari/meta.json' with { type: 'json' };
import { loaders } from '../generated/loaders';
import muslimMeta from '../generated/muslim/meta.json' with { type: 'json' };
import manifest from '../source/MANIFEST.json' with { type: 'json' };
import type { BookId, BookMeta, HadithRecord, SectionFile } from './types';

export type { BookId, BookMeta, HadithRecord, SectionMeta, SectionFile } from './types';

export const BOOK_IDS = ['bukhari', 'muslim'] as const satisfies readonly BookId[];

export const books: Record<BookId, BookMeta & { name: { en: string; ar: string; ur: string } }> = {
  bukhari: {
    ...(bukhariMeta as BookMeta),
    name: { en: 'Sahih al-Bukhari', ar: 'صحيح البخاري', ur: 'صحیح بخاری' },
  },
  muslim: {
    ...(muslimMeta as BookMeta),
    name: { en: 'Sahih Muslim', ar: 'صحيح مسلم', ur: 'صحیح مسلم' },
  },
};

export const isBookId = (value: string): value is BookId =>
  (BOOK_IDS as readonly string[]).includes(value);

/** Where the texts come from, shown on every hadith page. */
export const hadithSource = {
  dataset: 'hadith-api by Fawaz Ahmed',
  url: manifest.upstream.repository,
  commit: manifest.upstream.commit,
  translators: {
    bukhari: { en: 'Muhammad Muhsin Khan', ur: null },
    muslim: { en: 'Abdul Hamid Siddiqui', ur: null },
  },
} as const;

const cache = new Map<string, Promise<SectionFile>>();

/** One chapter with every hadith in it, or null if the chapter does not exist. */
export function loadSection(book: BookId, section: number): Promise<SectionFile> | null {
  const key = `${book}/${String(section)}`;
  const load = loaders[key];
  if (!load) return null;
  let pending = cache.get(key);
  if (!pending) {
    pending = load().then((m) => m.default as SectionFile);
    cache.set(key, pending);
  }
  return pending;
}

/** The chapter that contains a hadith number, if any. */
export function sectionOf(book: BookId, n: number): number | null {
  return books[book].sections.find((s) => n >= s.first && n <= s.last)?.n ?? null;
}

export async function loadHadith(book: BookId, n: number): Promise<HadithRecord | null> {
  const section = sectionOf(book, n);
  if (section === null) return null;
  const file = await loadSection(book, section);
  return file?.hadiths.find((h) => h.n === n) ?? null;
}
