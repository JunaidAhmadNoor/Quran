import { createHash } from 'node:crypto';
import { invalid } from './errors';

/**
 * Opaque keyset cursor. It records the filters it was made for, so reusing it with other
 * filters is rejected instead of silently returning the wrong page.
 */
export interface CursorState {
  /** Hash of the filters and sort the cursor belongs to. */
  f: string;
  /** Sort value of the last item (ISO date, number) — keyset cursors. */
  v?: string | number;
  /** _id of the last item — keyset cursors. */
  id?: string;
  /** Items already returned — offset cursors (trending). */
  o?: number;
}

export function filtersHash(filters: Record<string, unknown>): string {
  const stable = JSON.stringify(
    Object.keys(filters)
      .sort()
      .map((k) => [k, filters[k] ?? null]),
  );
  return createHash('sha256').update(stable).digest('base64url').slice(0, 12);
}

export function encodeCursor(state: CursorState): string {
  return Buffer.from(JSON.stringify(state)).toString('base64url');
}

export function decodeCursor(
  cursor: string | undefined,
  expectedFilters: string,
): CursorState | null {
  if (cursor === undefined) return null;
  let state: unknown;
  try {
    state = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw invalid('Malformed cursor', ['cursor']);
  }
  if (typeof state !== 'object' || state === null || (state as CursorState).f !== expectedFilters) {
    throw invalid('This cursor was made for different filters or sort', ['cursor']);
  }
  return state as CursorState;
}

/** Splits a page fetched with limit + 1 into items and the next cursor. */
export function page<T>(
  rows: T[],
  limit: number,
  cursorFor: (last: T) => CursorState,
): { rows: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const kept = hasMore ? rows.slice(0, limit) : rows;
  const last = kept.at(-1);
  return { rows: kept, nextCursor: hasMore && last ? encodeCursor(cursorFor(last)) : null };
}
