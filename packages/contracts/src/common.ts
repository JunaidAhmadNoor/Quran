import { z } from 'zod';

/** MongoDB ObjectId, always serialized as 24 lowercase hex characters. */
export const ObjectId = z
  .string()
  .regex(/^[a-f\d]{24}$/, 'Expected a 24-character lowercase hex id')
  .meta({
    id: 'ObjectId',
    description: 'MongoDB ObjectId as 24 lowercase hex characters.',
    examples: ['665f1c2e9b1d4a0012ab34cd'],
  });

export const IsoDateTime = z.iso.datetime().meta({
  id: 'DateTime',
  description: 'UTC timestamp in ISO 8601 format.',
  examples: ['2026-11-12T08:30:00.000Z'],
});

export const SurahNumber = z.int().min(1).max(114).meta({ description: 'Surah number, 1 to 114.' });

/** Path and query strings arrive as text; coerce them. */
export const SurahNumberParam = z.coerce
  .number()
  .int()
  .min(1)
  .max(114)
  .meta({ description: 'Surah number, 1 to 114.', examples: [1] });

/** Upper bound only; the exact per-surah maximum is checked against quran-data in the service. */
export const AyahNumber = z
  .int()
  .min(1)
  .max(286)
  .meta({ description: 'Ayah number within the surah (1-based).' });

/** ISO 3166-1 alpha-2 country code. */
export const CountryCode = z
  .string()
  .regex(/^[A-Z]{2}$/)
  .meta({ description: 'ISO 3166-1 alpha-2 country code.', examples: ['PK'] });

export const Cursor = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[A-Za-z0-9_-]+$/)
  .meta({
    id: 'Cursor',
    description:
      'Opaque pagination cursor (base64url). Pass back unchanged with the same filters and sort.',
  });

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export const PageQuery = z.object({
  cursor: Cursor.optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export function paginated<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: Cursor.nullable().meta({ description: 'null when there are no more items.' }),
  });
}

export const IdParams = z.object({ id: ObjectId });

/** Fails when an object has no keys; used for PATCH bodies. */
export function nonEmptyPatch(value: object): boolean {
  return Object.keys(value).length > 0;
}

export const NON_EMPTY_PATCH_MESSAGE = 'Provide at least one field to update';

/** Refinement for any schema carrying ayahFrom/ayahTo. */
export function ayahRangeIsOrdered(value: { ayahFrom?: number; ayahTo?: number }): boolean {
  if (value.ayahFrom === undefined || value.ayahTo === undefined) return true;
  return value.ayahFrom <= value.ayahTo;
}

export const AYAH_RANGE_MESSAGE = 'ayahFrom must be less than or equal to ayahTo';
