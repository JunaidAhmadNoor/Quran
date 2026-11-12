import { z } from 'zod';

/**
 * Every error the API can return. Clients must treat an unknown code as a generic error for
 * its HTTP status, so a new code can be added in a minor version.
 */
export const ErrorCode = z
  .enum([
    'VALIDATION_ERROR',
    'INVALID_AYAH_RANGE',
    'UNAUTHENTICATED',
    'FORBIDDEN',
    'RECITER_PROFILE_REQUIRED',
    'REAUTH_REQUIRED',
    'NOT_FOUND',
    'CONFLICT',
    'ALREADY_REPORTED',
    'UPLOAD_EXPIRED',
    'UPLOAD_NOT_FOUND',
    'UPLOAD_MISMATCH',
    'FILE_TOO_LARGE',
    'UNSUPPORTED_MEDIA_TYPE',
    'QUOTA_EXCEEDED',
    'RATE_LIMITED',
    'INTERNAL_ERROR',
    'SERVICE_UNAVAILABLE',
  ])
  .meta({ id: 'ErrorCode' });
export type ErrorCode = z.infer<typeof ErrorCode>;

export const errorStatus = {
  VALIDATION_ERROR: 400,
  INVALID_AYAH_RANGE: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  RECITER_PROFILE_REQUIRED: 403,
  REAUTH_REQUIRED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  ALREADY_REPORTED: 409,
  UPLOAD_EXPIRED: 410,
  UPLOAD_NOT_FOUND: 422,
  UPLOAD_MISMATCH: 422,
  FILE_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  QUOTA_EXCEEDED: 403,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const satisfies Record<ErrorCode, number>;

export const errorDescriptions = {
  VALIDATION_ERROR: 'The request did not match the schema. details.issues lists each problem.',
  INVALID_AYAH_RANGE: 'The ayah range does not exist in that surah.',
  UNAUTHENTICATED: 'No valid session cookie or bearer token.',
  FORBIDDEN: 'Signed in, but not allowed to do this.',
  REAUTH_REQUIRED: 'This action needs a recent sign-in. Sign in again and retry.',
  RECITER_PROFILE_REQUIRED:
    'Switch to reciter mode once (PUT /me/mode) to turn on the reciter profile before uploading.',
  NOT_FOUND: 'The resource does not exist or is not visible to the caller.',
  CONFLICT: 'The resource is not in a state that allows this action.',
  ALREADY_REPORTED: 'The caller already has an open report on this recitation.',
  UPLOAD_EXPIRED: 'The upload token has expired. Request a new presigned URL.',
  UPLOAD_NOT_FOUND: 'No uploaded file was found in storage for this upload token.',
  UPLOAD_MISMATCH: 'The stored file size or type differs from what was presigned.',
  FILE_TOO_LARGE: 'The file is larger than the 60 MB limit.',
  UNSUPPORTED_MEDIA_TYPE: 'Only audio/mpeg, audio/mp4, audio/ogg and audio/webm are accepted.',
  QUOTA_EXCEEDED: 'The caller has reached their storage quota.',
  RATE_LIMITED: 'Too many requests. Retry after the number of seconds in details.retryAfterSec.',
  INTERNAL_ERROR: 'Unexpected server error.',
  SERVICE_UNAVAILABLE: 'A dependency (for example the database) is unavailable.',
} as const satisfies Record<ErrorCode, string>;

export const ErrorResponse = z
  .object({
    error: z.object({
      code: ErrorCode,
      message: z.string().meta({ description: 'Human-readable, English. Not for display logic.' }),
      details: z.record(z.string(), z.unknown()),
    }),
  })
  .meta({
    id: 'ErrorResponse',
    examples: [
      {
        error: {
          code: 'FORBIDDEN',
          message: 'Only moderators can approve recitations.',
          details: {},
        },
      },
    ],
  });
export type ErrorResponse = z.infer<typeof ErrorResponse>;
