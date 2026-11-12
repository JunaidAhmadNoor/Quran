import { z } from 'zod';
import {
  AYAH_RANGE_MESSAGE,
  AyahNumber,
  IsoDateTime,
  SurahNumber,
  ayahRangeIsOrdered,
} from '../common';
import { AudioContentType } from '../enums';
import { MAX_UPLOAD_BYTES, MIN_UPLOAD_BYTES } from '../limits';

/**
 * contentType and sizeBytes are deliberately loose here: the service rejects them with the
 * specific codes UNSUPPORTED_MEDIA_TYPE and FILE_TOO_LARGE instead of a generic VALIDATION_ERROR.
 * Forms should validate with PresignFormSchema below for instant feedback.
 */
export const PresignUploadBody = z
  .object({
    surah: SurahNumber,
    ayahFrom: AyahNumber,
    ayahTo: AyahNumber,
    contentType: z
      .string()
      .min(1)
      .max(100)
      .meta({
        description: `One of: ${AudioContentType.options.join(', ')}.`,
        examples: ['audio/mpeg'],
      }),
    sizeBytes: z
      .int()
      .positive()
      .meta({
        description: `File size in bytes, ${MIN_UPLOAD_BYTES} to ${MAX_UPLOAD_BYTES}.`,
      }),
    rightsConfirmed: z.literal(true).meta({
      description: '"This is my own recitation or I have permission to share it." Must be true.',
    }),
  })
  .refine(ayahRangeIsOrdered, { message: AYAH_RANGE_MESSAGE, path: ['ayahTo'] })
  .meta({ id: 'PresignUploadBody' });

/** Strict client-side variant with the same rules the service enforces. */
export const PresignFormSchema = z
  .object({
    surah: SurahNumber,
    ayahFrom: AyahNumber,
    ayahTo: AyahNumber,
    contentType: AudioContentType,
    sizeBytes: z.int().min(MIN_UPLOAD_BYTES).max(MAX_UPLOAD_BYTES),
    rightsConfirmed: z.literal(true),
  })
  .refine(ayahRangeIsOrdered, { message: AYAH_RANGE_MESSAGE, path: ['ayahTo'] });

export const PresignUploadResponse = z
  .object({
    uploadUrl: z.url().meta({ description: 'Presigned R2 URL. PUT the raw file bytes here.' }),
    method: z.literal('PUT'),
    headers: z
      .record(z.string(), z.string())
      .meta({ description: 'Headers the PUT must send exactly, including Content-Type.' }),
    uploadToken: z.string().meta({
      description: 'Signed token describing this upload. Send it to POST /recitations to confirm.',
    }),
    expiresAt: IsoDateTime,
  })
  .meta({ id: 'PresignUploadResponse' });
