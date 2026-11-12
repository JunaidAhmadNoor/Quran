import type { Recitation, RecitationSort, RecitationStatus } from '@tilawah/contracts';
import type { z } from 'zod';

export type RecitationItem = z.output<typeof Recitation>;
export interface Page {
  items: RecitationItem[];
  nextCursor: string | null;
}

/** Where a list's further pages come from (serializable, so Server Components can pass it). */
export type ListSource =
  | { kind: 'recitations'; surah?: number; reciterId?: string; sort: RecitationSort }
  | { kind: 'likes' }
  | { kind: 'mine'; status?: RecitationStatus };
