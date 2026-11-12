import { Types } from '@tilawah/db';
import type { CursorState } from '../cursor';

export const oid = (id: string): Types.ObjectId => new Types.ObjectId(id);
export const newId = (): Types.ObjectId => new Types.ObjectId();

type SortField = 'createdAt' | 'updatedAt' | 'playCount' | '_id';

/** Mongo filter for "items after the cursor" in a (field, _id) keyset ordering. */
export function afterCursor(field: SortField, direction: 1 | -1, cursor: CursorState | null) {
  if (cursor?.id === undefined) return {};
  const op = direction === -1 ? '$lt' : '$gt';
  const id = oid(cursor.id);
  if (field === '_id') return { _id: { [op]: id } };
  if (cursor.v === undefined) return {};
  const value = field === 'playCount' ? Number(cursor.v) : new Date(String(cursor.v));
  return { $or: [{ [field]: { [op]: value } }, { [field]: value, _id: { [op]: id } }] };
}

export function cursorOf(
  field: SortField,
  filters: string,
  doc: { _id: Types.ObjectId; createdAt?: Date; updatedAt?: Date; playCount?: number },
): CursorState {
  const id = doc._id.toHexString();
  if (field === '_id') return { f: filters, id };
  const value = doc[field];
  return { f: filters, id, v: value instanceof Date ? value.toISOString() : value };
}
