import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AudioContentType } from '@tilawah/contracts';
import { DomainError, invalid } from './errors';

/** Everything the server promised in POST /uploads/presign, signed so it cannot be altered. */
export interface UploadTicket {
  v: 1;
  /** Also the future recitation _id, so a ticket can be confirmed only once. */
  uploadId: string;
  userId: string;
  key: string;
  contentType: AudioContentType;
  sizeBytes: number;
  surah: number;
  ayahFrom: number;
  ayahTo: number;
  rightsConfirmedAt: string;
  /** Expiry, ms since epoch. */
  exp: number;
}

const sign = (payload: string, secret: string) =>
  createHmac('sha256', secret).update(payload).digest('base64url');

export function signUploadTicket(ticket: UploadTicket, secret: string): string {
  const payload = Buffer.from(JSON.stringify(ticket)).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyUploadTicket(token: string, secret: string, now: Date): UploadTicket {
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined)
    throw invalid('Invalid upload token', ['uploadToken']);
  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw invalid('Invalid upload token', ['uploadToken']);
  }
  // The signature proves we issued it; the version check guards future format changes.
  const ticket = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
    v?: unknown;
  } & Omit<UploadTicket, 'v'>;
  if (ticket.v !== 1) throw invalid('Unsupported upload token', ['uploadToken']);
  if (ticket.exp <= now.getTime()) {
    throw new DomainError('UPLOAD_EXPIRED', 'The upload token has expired. Upload the file again.');
  }
  return { ...ticket, v: 1 };
}
