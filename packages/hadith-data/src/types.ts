export type BookId = 'bukhari' | 'muslim';

export interface HadithRecord {
  /** Hadith number in the collection (a few Bukhari numbers have a sub-number, e.g. 402.2). */
  n: number;
  /** In-book reference: [book (kitab) number, hadith number within it]. */
  ref: [number, number];
  /** Arabic text (empty when the source has none). */
  ar: string;
  /** English translation (empty when the source has none). */
  en: string;
  /** Urdu translation (empty when the source has none). */
  ur: string;
}

export interface SectionMeta {
  /** Book (kitab) number within the collection; 0 is Sahih Muslim's introduction. */
  n: number;
  /** English title from the source. */
  title: string;
  first: number;
  last: number;
  count: number;
}

export interface BookMeta {
  id: BookId;
  hadithCount: number;
  sections: SectionMeta[];
}

export interface SectionFile {
  book: BookId;
  section: number;
  hadiths: HadithRecord[];
}
