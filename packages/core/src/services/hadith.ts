// Sahih al-Bukhari and Sahih Muslim (read-only, from @tilawah/hadith-data).
import {
  books,
  hadithSource,
  isBookId,
  loadHadith,
  loadSection,
  type BookId,
  type HadithRecord,
} from '@tilawah/hadith-data';
import { DAY_MS } from '../clock';
import type { C, Out } from '../context';
import { decodeCursor, encodeCursor, filtersHash } from '../cursor';
import { notFound } from '../errors';

type HadithOut = Out<typeof C.Hadith>;

const summary = (id: BookId): Out<typeof C.HadithBookSummary> => ({
  id,
  name: books[id].name,
  hadithCount: books[id].hadithCount,
  sectionCount: books[id].sections.length,
});

const present = (book: BookId, section: number, h: HadithRecord): HadithOut => ({
  book,
  number: h.n,
  section,
  reference: { book: h.ref[0], hadith: h.ref[1] },
  text: { ar: h.ar || null, en: h.en || null, ur: h.ur || null },
});

/**
 * Text for searching: diacritics removed, Arabic/Urdu letter forms unified, lower case. Applied
 * to both the query and the texts, so "انما الاعمال", "إِنَّمَا الْأَعْمَالُ" and "INTENTIONS" match.
 */
export function searchable(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىی]/g, 'ي')
    .replace(/ک/g, 'ك')
    .replace(/[ہھ]/g, 'ه')
    .replace(/ـ/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

interface Entry {
  section: number;
  record: HadithRecord;
  text: string;
}

export class HadithService {
  private readonly indexes = new Map<BookId, Promise<Entry[]>>();

  listBooks(): Out<typeof C.HadithBooksResponse> {
    return { items: (['bukhari', 'muslim'] as const).map(summary) };
  }

  getBook(id: string): Out<typeof C.HadithBook> {
    if (!isBookId(id)) throw notFound('Hadith collection');
    return {
      ...summary(id),
      sections: books[id].sections,
      source: {
        dataset: hadithSource.dataset,
        url: hadithSource.url,
        commit: hadithSource.commit,
        translators: hadithSource.translators[id],
      },
    };
  }

  async getSection(
    id: string,
    n: number,
    query: Out<typeof C.PageQuery>,
  ): Promise<Out<typeof C.HadithSectionPage>> {
    if (!isBookId(id)) throw notFound('Hadith collection');
    const meta = books[id].sections.find((s) => s.n === n);
    const file = meta ? await loadSection(id, n) : null;
    if (!meta || !file) throw notFound('Book');
    const hash = filtersHash({ book: id, section: n });
    const offset = decodeCursor(query.cursor, hash)?.o ?? 0;
    const rows = file.hadiths.slice(offset, offset + query.limit);
    const next = offset + query.limit;
    return {
      book: summary(id),
      section: meta,
      items: rows.map((h) => present(id, n, h)),
      nextCursor: next < file.hadiths.length ? encodeCursor({ f: hash, o: next }) : null,
    };
  }

  private daily: Promise<{ section: number; record: HadithRecord }[]> | null = null;

  /**
   * One hadith for the day, the same for everyone on a given UTC day: a short saying of the
   * Prophet ﷺ from Sahih al-Bukhari ("Narrated …: The Prophet said, …") with all three languages,
   * leaving out narrations that only point to another one ("similar", "the same", "as below").
   */
  async ofTheDay(now: Date): Promise<HadithOut> {
    this.daily ??= (async () => {
      const direct = /^Narrated [^:]+:\s*(The Prophet|Allah's Messenger)\s*\([^)]*\)\s*said/;
      const list: { section: number; record: HadithRecord }[] = [];
      for (const meta of books.bukhari.sections) {
        const file = await loadSection('bukhari', meta.n);
        for (const h of file?.hadiths ?? []) {
          if (
            h.ar !== '' &&
            h.ur !== '' &&
            h.en.length >= 80 &&
            h.en.length <= 360 &&
            direct.test(h.en) &&
            !/similar|the same|as below|as above/i.test(h.en)
          )
            list.push({ section: meta.n, record: h });
        }
      }
      return list;
    })();
    const list = await this.daily;
    const day = Math.floor(now.getTime() / DAY_MS);
    const pick = list[(day * 7919) % Math.max(1, list.length)];
    if (!pick) throw notFound('Hadith');
    return present('bukhari', pick.section, pick.record);
  }

  async getHadith(id: string, number: number): Promise<HadithOut> {
    if (!isBookId(id)) throw notFound('Hadith collection');
    const h = await loadHadith(id, number);
    if (!h) throw notFound('Hadith');
    const section = books[id].sections.find((s) => number >= s.first && number <= s.last);
    return present(id, section?.n ?? 0, h);
  }

  /** Every query word must appear in the hadith (in any of its three languages). */
  async search(
    id: string,
    query: Out<typeof C.HadithSearchQuery>,
  ): Promise<Out<typeof C.HadithSearchPage>> {
    if (!isBookId(id)) throw notFound('Hadith collection');
    const q = query.q.trim();
    if (/^\d+(\.\d+)?$/.test(q)) {
      const h = await loadHadith(id, Number(q));
      return {
        items: h ? [await this.getHadith(id, h.n)] : [],
        nextCursor: null,
        total: h ? 1 : 0,
      };
    }
    const words = searchable(q).split(' ').filter(Boolean);
    const hash = filtersHash({ book: id, q: words.join(' ') });
    const offset = decodeCursor(query.cursor, hash)?.o ?? 0;
    const index = await this.index(id);
    const matches = index.filter((e) => words.every((w) => e.text.includes(w)));
    const page = matches.slice(offset, offset + query.limit);
    const next = offset + query.limit;
    return {
      items: page.map((e) => present(id, e.section, e.record)),
      nextCursor: next < matches.length ? encodeCursor({ f: hash, o: next }) : null,
      total: matches.length,
    };
  }

  /** Built once per collection on first search (all chapters, normalized), then kept. */
  private index(id: BookId): Promise<Entry[]> {
    let pending = this.indexes.get(id);
    if (!pending) {
      pending = (async () => {
        const entries: Entry[] = [];
        for (const s of books[id].sections) {
          const file = await loadSection(id, s.n);
          for (const record of file?.hadiths ?? [])
            entries.push({
              section: s.n,
              record,
              text: ` ${searchable(`${record.ar} ${record.en} ${record.ur}`)} `,
            });
        }
        return entries;
      })();
      this.indexes.set(id, pending);
    }
    return pending;
  }
}
