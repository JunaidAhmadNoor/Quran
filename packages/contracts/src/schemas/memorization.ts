import { z } from 'zod';
import {
  AYAH_RANGE_MESSAGE,
  AyahNumber,
  IsoDateTime,
  ObjectId,
  SurahNumber,
  ayahRangeIsOrdered,
} from '../common';
import { MemorizationMode, MistakeType } from '../enums';
import { MAX_MISTAKES_PER_SESSION, MAX_SESSION_DURATION_SEC } from '../limits';

export const Mistake = z
  .object({
    ayah: AyahNumber,
    word: z.int().min(1).meta({ description: '1-based word position within the ayah.' }),
    type: MistakeType,
  })
  .meta({
    id: 'Mistake',
    description: 'A word position only. The words the user said are never sent or stored.',
  });

export const CreateMemorizationSessionBody = z
  .object({
    surah: SurahNumber,
    ayahFrom: AyahNumber,
    ayahTo: AyahNumber,
    mode: MemorizationMode,
    wordsTotal: z.int().min(1).meta({
      description: 'Must equal the word count of the range in quran-data; the server checks it.',
    }),
    wordsCorrect: z.int().min(0),
    mistakes: z.array(Mistake).max(MAX_MISTAKES_PER_SESSION),
    startedAt: IsoDateTime,
    endedAt: IsoDateTime,
  })
  .refine(ayahRangeIsOrdered, { message: AYAH_RANGE_MESSAGE, path: ['ayahTo'] })
  .refine((v) => v.wordsCorrect <= v.wordsTotal, {
    message: 'wordsCorrect cannot exceed wordsTotal',
    path: ['wordsCorrect'],
  })
  .refine(
    (v) => {
      const ms = Date.parse(v.endedAt) - Date.parse(v.startedAt);
      return ms >= 0 && ms <= MAX_SESSION_DURATION_SEC * 1000;
    },
    { message: 'endedAt must be after startedAt and within 6 hours', path: ['endedAt'] },
  )
  .refine((v) => v.mistakes.every((m) => m.ayah >= v.ayahFrom && m.ayah <= v.ayahTo), {
    message: 'Every mistake must be inside the ayah range',
    path: ['mistakes'],
  })
  .meta({ id: 'CreateMemorizationSessionBody' });

export const MemorizationProgress = z
  .object({
    surah: SurahNumber,
    lastAyah: AyahNumber.meta({ description: 'Highest ayahTo reached in any session.' }),
    bestAccuracy: z
      .number()
      .min(0)
      .max(1)
      .meta({ description: 'Best wordsCorrect / wordsTotal over all sessions for this surah.' }),
    lastPracticedAt: IsoDateTime,
  })
  .meta({ id: 'MemorizationProgress' });

export const CreateMemorizationSessionResponse = z
  .object({
    id: ObjectId,
    accuracy: z.number().min(0).max(1),
    progress: MemorizationProgress,
  })
  .meta({ id: 'CreateMemorizationSessionResponse' });

export const MemorizationProgressResponse = z
  .object({ items: z.array(MemorizationProgress).max(114) })
  .meta({ id: 'MemorizationProgressResponse' });
