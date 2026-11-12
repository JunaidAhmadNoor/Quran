import { describe, expect, it } from 'vitest';
import {
  CreateMemorizationSessionBody,
  CreateReportBody,
  ErrorResponse,
  ListRecitationsQuery,
  MAX_UPLOAD_BYTES,
  ObjectId,
  PresignFormSchema,
  PresignUploadBody,
  RecitationDecisionBody,
  UpdatePlaylistBody,
  Role,
  SwitchModeBody,
  UpdateMeBody,
  UpdateRecitationBody,
  endpoints,
  errorStatus,
} from '../src';

const id = '665f1c2e9b1d4a0012ab34cd';

describe('primitives', () => {
  it.each([
    [id, true],
    ['665F1C2E9B1D4A0012AB34CD', false],
    ['665f1c2e9b1d4a0012ab34c', false],
    ['not-an-id', false],
  ])('ObjectId %s → %s', (value, ok) => {
    expect(ObjectId.safeParse(value).success).toBe(ok);
  });
});

describe('pagination query', () => {
  it('coerces strings and applies defaults', () => {
    expect(ListRecitationsQuery.parse({ surah: '2' })).toEqual({
      surah: 2,
      limit: 20,
      sort: 'newest',
    });
  });

  it.each([['0'], ['51'], ['abc']])('rejects limit=%s', (limit) => {
    expect(ListRecitationsQuery.safeParse({ limit }).success).toBe(false);
  });

  it('rejects surah 115', () => {
    expect(ListRecitationsQuery.safeParse({ surah: '115' }).success).toBe(false);
  });
});

describe('uploads', () => {
  const base = {
    surah: 1,
    ayahFrom: 1,
    ayahTo: 7,
    contentType: 'audio/mpeg',
    sizeBytes: 5_000_000,
    rightsConfirmed: true,
  } as const;

  it('accepts a valid presign request', () => {
    expect(PresignUploadBody.safeParse(base).success).toBe(true);
  });

  it('requires the rights confirmation', () => {
    expect(PresignUploadBody.safeParse({ ...base, rightsConfirmed: false }).success).toBe(false);
  });

  it('rejects a reversed ayah range', () => {
    expect(PresignUploadBody.safeParse({ ...base, ayahFrom: 5, ayahTo: 2 }).success).toBe(false);
  });

  it('leaves type and size to the service so it can return specific error codes', () => {
    const r = PresignUploadBody.safeParse({
      ...base,
      contentType: 'video/mp4',
      sizeBytes: 10 ** 9,
    });
    expect(r.success).toBe(true);
  });

  it('form schema enforces type and size on the client', () => {
    expect(PresignFormSchema.safeParse({ ...base, contentType: 'video/mp4' }).success).toBe(false);
    expect(PresignFormSchema.safeParse({ ...base, sizeBytes: MAX_UPLOAD_BYTES + 1 }).success).toBe(
      false,
    );
  });
});

describe('patch bodies', () => {
  it('reject empty objects', () => {
    expect(UpdateRecitationBody.safeParse({}).success).toBe(false);
    expect(UpdatePlaylistBody.safeParse({}).success).toBe(false);
  });

  it('reject duplicate playlist items', () => {
    expect(UpdatePlaylistBody.safeParse({ recitationIds: [id, id] }).success).toBe(false);
  });
});

describe('reports', () => {
  it('require a note for reason "other"', () => {
    expect(CreateReportBody.safeParse({ reason: 'other' }).success).toBe(false);
    expect(CreateReportBody.safeParse({ reason: 'other', note: 'Background music' }).success).toBe(
      true,
    );
    expect(CreateReportBody.safeParse({ reason: 'wrong_surah' }).success).toBe(true);
  });
});

describe('moderation decisions', () => {
  it('require a reason to reject or remove, not to approve', () => {
    expect(RecitationDecisionBody.safeParse({ decision: 'approve' }).success).toBe(true);
    expect(RecitationDecisionBody.safeParse({ decision: 'reject' }).success).toBe(false);
    expect(RecitationDecisionBody.parse({ decision: 'remove', reason: 'Copyright claim' })).toEqual(
      {
        decision: 'remove',
        reason: 'Copyright claim',
        resolveReports: true,
      },
    );
  });
});

describe('memorization sessions', () => {
  const base = {
    surah: 112,
    ayahFrom: 1,
    ayahTo: 4,
    mode: 'reveal',
    wordsTotal: 15,
    wordsCorrect: 14,
    mistakes: [{ ayah: 3, word: 2, type: 'missed' }],
    startedAt: '2026-11-12T08:00:00.000Z',
    endedAt: '2026-11-12T08:03:00.000Z',
  } as const;

  it('accepts a valid session', () => {
    expect(CreateMemorizationSessionBody.safeParse(base).success).toBe(true);
  });

  it.each([
    ['more correct than total', { wordsCorrect: 16 }],
    ['ends before it starts', { endedAt: '2026-11-12T07:59:00.000Z' }],
    ['mistake outside range', { mistakes: [{ ayah: 5, word: 1, type: 'missed' }] }],
  ])('rejects a session that has %s', (_label, patch) => {
    expect(CreateMemorizationSessionBody.safeParse({ ...base, ...patch }).success).toBe(false);
  });
});

describe('errors', () => {
  it('matches the documented envelope', () => {
    expect(
      ErrorResponse.safeParse({ error: { code: 'FORBIDDEN', message: 'No', details: {} } }).success,
    ).toBe(true);
  });

  it('maps upload failures to distinct statuses', () => {
    expect(errorStatus.UNSUPPORTED_MEDIA_TYPE).toBe(415);
    expect(errorStatus.FILE_TOO_LARGE).toBe(413);
    expect(errorStatus.UPLOAD_EXPIRED).toBe(410);
    expect(errorStatus.UPLOAD_NOT_FOUND).toBe(422);
  });
});

describe('account modes and roles', () => {
  it('accepts only listener and reciter modes', () => {
    expect(SwitchModeBody.safeParse({ mode: 'reciter' }).success).toBe(true);
    expect(SwitchModeBody.safeParse({ mode: 'listener' }).success).toBe(true);
    expect(SwitchModeBody.safeParse({ mode: 'moderator' }).success).toBe(false);
  });

  it('keeps reciting out of staff roles, so switching mode never grants permissions', () => {
    expect(Role.options).toEqual(['user', 'moderator', 'admin']);
  });

  it('does not let users set their own role or badge through profile edits', () => {
    const parsed = UpdateMeBody.parse({ name: 'Ali', role: 'admin', verifiedReciter: true });
    expect(parsed).toEqual({ name: 'Ali' });
  });

  it('gates uploads behind the reciter profile', () => {
    expect(endpoints.presignUpload.errors).toContain('RECITER_PROFILE_REQUIRED');
    expect(endpoints.createRecitation.errors).toContain('RECITER_PROFILE_REQUIRED');
    expect(errorStatus.RECITER_PROFILE_REQUIRED).toBe(403);
  });
});
