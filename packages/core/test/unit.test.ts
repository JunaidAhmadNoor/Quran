import { describe, expect, it } from 'vitest';
import {
  autoApproves,
  isStaff,
  requireAdmin,
  requireReciterProfile,
  requireStaff,
  type Actor,
} from '../src/actor';
import { decodeCursor, encodeCursor, filtersHash, page } from '../src/cursor';
import { DomainError } from '../src/errors';
import { hashIp } from '../src/repositories/rate-limiter';
import { signUploadTicket, verifyUploadTicket, type UploadTicket } from '../src/upload-token';

const actor = (overrides: Partial<Actor> = {}): Actor => ({
  userId: '665f1c2e9b1d4a0012ab34cd',
  role: 'user',
  mode: 'listener',
  reciterSince: null,
  verifiedReciter: false,
  sessionCreatedAt: new Date(),
  ...overrides,
});

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as DomainError).code;
  }
  return 'NO_ERROR';
};

describe('permissions', () => {
  it('auto-approves only verified reciters and staff, not reciter mode', () => {
    expect(autoApproves(actor({ mode: 'reciter', reciterSince: new Date() }))).toBe(false);
    expect(autoApproves(actor({ verifiedReciter: true }))).toBe(true);
    expect(autoApproves(actor({ role: 'moderator' }))).toBe(true);
  });

  it('lets only staff moderate and only admins administer', () => {
    expect(isStaff(actor())).toBe(false);
    expect(code(() => requireStaff(actor()))).toBe('FORBIDDEN');
    expect(code(() => requireStaff(null))).toBe('UNAUTHENTICATED');
    expect(code(() => requireStaff(actor({ role: 'moderator' })))).toBe('NO_ERROR');
    expect(code(() => requireAdmin(actor({ role: 'moderator' })))).toBe('FORBIDDEN');
  });

  it('requires the reciter profile to upload', () => {
    expect(
      code(() => {
        requireReciterProfile(actor());
      }),
    ).toBe('RECITER_PROFILE_REQUIRED');
    expect(
      code(() => {
        requireReciterProfile(actor({ reciterSince: new Date() }));
      }),
    ).toBe('NO_ERROR');
  });
});

describe('cursors', () => {
  const hash = filtersHash({ surah: 1, sort: 'newest' });

  it('round-trips and ignores filter key order', () => {
    expect(filtersHash({ sort: 'newest', surah: 1 })).toBe(hash);
    const encoded = encodeCursor({ f: hash, v: 3, id: 'abc' });
    expect(decodeCursor(encoded, hash)).toEqual({ f: hash, v: 3, id: 'abc' });
    expect(decodeCursor(undefined, hash)).toBeNull();
  });

  it('rejects cursors made for other filters, and garbage', () => {
    const other = encodeCursor({ f: filtersHash({ surah: 2 }) });
    expect(() => decodeCursor(other, hash)).toThrow(/different filters/);
    expect(() => decodeCursor('%%%', hash)).toThrow(DomainError);
  });

  it('builds a page from limit + 1 rows', () => {
    expect(page([1, 2, 3], 2, (n) => ({ f: hash, o: n })).nextCursor).not.toBeNull();
    expect(page([1, 2], 2, (n) => ({ f: hash, o: n }))).toEqual({ rows: [1, 2], nextCursor: null });
  });
});

describe('upload tokens', () => {
  const ticket: UploadTicket = {
    v: 1,
    uploadId: '665f1c2e9b1d4a0012ab34cd',
    userId: '665f1c2e9b1d4a0012ab34ce',
    key: 'incoming/x/y.mp3',
    contentType: 'audio/mpeg',
    sizeBytes: 1000,
    surah: 1,
    ayahFrom: 1,
    ayahTo: 7,
    rightsConfirmedAt: '2026-11-12T08:00:00.000Z',
    exp: Date.parse('2026-11-12T09:00:00.000Z'),
  };
  const token = signUploadTicket(ticket, 'secret');

  it('verifies a valid token', () => {
    expect(verifyUploadTicket(token, 'secret', new Date('2026-11-12T08:30:00Z'))).toEqual(ticket);
  });

  it('rejects tampering, wrong secrets and malformed tokens', () => {
    const [payload, sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ ...ticket, sizeBytes: 1 })).toString('base64url');
    const now = new Date('2026-11-12T08:30:00Z');
    expect(code(() => verifyUploadTicket(`${forged}.${sig ?? ''}`, 'secret', now))).toBe(
      'VALIDATION_ERROR',
    );
    expect(code(() => verifyUploadTicket(token, 'other', now))).toBe('VALIDATION_ERROR');
    expect(code(() => verifyUploadTicket(payload ?? '', 'secret', now))).toBe('VALIDATION_ERROR');
  });

  it('reports expiry with its own code', () => {
    expect(code(() => verifyUploadTicket(token, 'secret', new Date('2026-11-12T09:00:00Z')))).toBe(
      'UPLOAD_EXPIRED',
    );
  });
});

describe('IP hashing', () => {
  it('is stable, keyed and never contains the IP', () => {
    const h = hashIp('203.0.113.7', 'k1');
    expect(h).toBe(hashIp('203.0.113.7', 'k1'));
    expect(h).not.toBe(hashIp('203.0.113.7', 'k2'));
    expect(h).not.toContain('203');
  });
});
