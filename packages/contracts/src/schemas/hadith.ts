import { z } from 'zod';
import { PageQuery, paginated } from '../common';

export const HadithBookId = z
  .enum(['bukhari', 'muslim'])
  .meta({ id: 'HadithBookId', description: 'Sahih al-Bukhari or Sahih Muslim.' });

const LocalizedName = z.object({ en: z.string(), ar: z.string(), ur: z.string() });

export const HadithSection = z
  .object({
    n: z
      .int()
      .min(0)
      .meta({ description: 'Book (kitab) number; 0 is Sahih Muslim’s introduction.' }),
    title: z.string().meta({ description: 'English title from the source.' }),
    first: z.number().meta({ description: 'First hadith number in this book.' }),
    last: z.number(),
    count: z.int().min(1),
  })
  .meta({ id: 'HadithSection' });

export const HadithBookSummary = z
  .object({
    id: HadithBookId,
    name: LocalizedName,
    hadithCount: z.int().min(1),
    sectionCount: z.int().min(1),
  })
  .meta({ id: 'HadithBookSummary' });

export const HadithSource = z
  .object({
    dataset: z.string(),
    url: z.url(),
    commit: z.string(),
    translators: z.object({ en: z.string(), ur: z.string().nullable() }),
  })
  .meta({ id: 'HadithSource', description: 'Credits shown with the texts.' });

export const HadithBook = HadithBookSummary.extend({
  sections: z.array(HadithSection),
  source: HadithSource,
}).meta({ id: 'HadithBook' });

export const Hadith = z
  .object({
    book: HadithBookId,
    number: z
      .number()
      .meta({ description: 'Hadith number (a few have a sub-number, e.g. 402.2).' }),
    section: z.int().min(0),
    reference: z.object({ book: z.int().min(0), hadith: z.int().min(0) }),
    text: z.object({
      ar: z.string().nullable(),
      en: z.string().nullable(),
      ur: z.string().nullable().meta({ description: 'null where the source has no Urdu text.' }),
    }),
  })
  .meta({ id: 'Hadith' });

export const HadithBookParams = z.object({ book: HadithBookId });
export const HadithSectionParams = z.object({
  book: HadithBookId,
  section: z.coerce.number().int().min(0).max(200),
});
export const HadithParams = z.object({
  book: HadithBookId,
  number: z.coerce.number().positive().max(100_000),
});

export const HadithBooksResponse = z
  .object({ items: z.array(HadithBookSummary) })
  .meta({ id: 'HadithBooksResponse' });

export const HadithSectionPage = paginated(Hadith)
  .extend({ book: HadithBookSummary, section: HadithSection })
  .meta({ id: 'HadithSectionPage' });

export const HadithSearchQuery = PageQuery.extend({
  q: z.string().trim().min(2).max(100).meta({
    description: 'Words in Arabic (diacritics ignored), English or Urdu, or a hadith number.',
  }),
});

export const HadithSearchPage = paginated(Hadith)
  .extend({ total: z.int().min(0).meta({ description: 'All matches, across pages.' }) })
  .meta({ id: 'HadithSearchPage' });
