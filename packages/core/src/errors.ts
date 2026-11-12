import type { ErrorCode } from '@tilawah/contracts';

/** A rule violation the API reports with its own code. Anything else is an INTERNAL_ERROR. */
export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export const notFound = (what: string) => new DomainError('NOT_FOUND', `${what} not found`);
export const forbidden = (message: string) => new DomainError('FORBIDDEN', message);
export const conflict = (message: string, details: Record<string, unknown> = {}) =>
  new DomainError('CONFLICT', message, details);
export const invalid = (message: string, path: (string | number)[] = []) =>
  new DomainError('VALIDATION_ERROR', message, { issues: [{ path, message }] });
