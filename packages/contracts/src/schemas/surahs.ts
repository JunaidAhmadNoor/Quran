import { z } from 'zod';
import {
  AyahNumber,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  SurahNumber,
  SurahNumberParam,
} from '../common';
import { RecitationSort, RevelationPlace } from '../enums';
import { RecitationPage } from './recitations';

export const SurahSummary = z
  .object({
    number: SurahNumber,
    nameArabic: z.string().meta({ examples: ['الفاتحة'] }),
    nameTransliterated: z.string().meta({ examples: ['Al-Fatihah'] }),
    nameEnglish: z.string().meta({ examples: ['The Opening'] }),
    ayahCount: z.int().min(3).max(286),
    revelationPlace: RevelationPlace,
    revelationOrder: z.int().min(1).max(114),
    juz: z
      .array(z.int().min(1).max(30))
      .min(1)
      .meta({ description: 'Juz numbers this surah spans, ascending.' }),
  })
  .meta({ id: 'SurahSummary', description: 'From Tanzil metadata in packages/quran-data.' });

export const SurahParams = z.object({ n: SurahNumberParam });

export const ListSurahsResponse = z
  .object({ items: z.array(SurahSummary).length(114) })
  .meta({ id: 'ListSurahsResponse' });

export const GetSurahQuery = z.object({
  sort: RecitationSort.default('popular'),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export const GetSurahResponse = z
  .object({
    surah: SurahSummary,
    recitations: RecitationPage.meta({
      description: 'First page of approved recitations. Continue with GET /recitations?surah=n.',
    }),
  })
  .meta({ id: 'GetSurahResponse' });

export const QuranWord = z
  .object({
    position: z.int().min(1).meta({ description: '1-based word position within the ayah.' }),
    text: z.string().min(1),
  })
  .meta({ id: 'QuranWord' });

export const Ayah = z
  .object({
    number: AyahNumber,
    text: z.string().meta({ description: 'Exact Tanzil Uthmani text of the ayah.' }),
    words: z.array(QuranWord).min(1),
  })
  .meta({ id: 'Ayah' });

export const TextSource = z
  .object({
    name: z.literal('Tanzil Quran Text'),
    edition: z.literal('Uthmani'),
    version: z.string().meta({ examples: ['1.1'] }),
    url: z.url(),
    license: z.string(),
    sha256: z.string().regex(/^[a-f\d]{64}$/),
  })
  .meta({
    id: 'TextSource',
    description: 'Attribution required by the Tanzil license. Clients must display it.',
  });

export const SurahTextResponse = z
  .object({
    surah: SurahNumber,
    bismillah: z.string().nullable().meta({
      description:
        'The bismillah shown above the surah, separated from ayah 1. null for surah 9; for surah 1 it is ayah 1 itself, so also null.',
    }),
    ayahs: z.array(Ayah).min(3),
    source: TextSource,
  })
  .meta({ id: 'SurahTextResponse' });
