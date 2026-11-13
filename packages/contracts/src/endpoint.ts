import type { z } from 'zod';
import type { ErrorCode } from './errors';
import type { RateLimitName } from './limits';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * public: no session required; a session is still read when present (liked state, owner view).
 * user: any signed-in account. moderator: moderator or admin. admin: admin only.
 */
export type AuthRequirement = 'public' | 'user' | 'moderator' | 'admin';

export type Tag =
  | 'Health'
  | 'Surahs'
  | 'Hadith'
  | 'Recitations'
  | 'Uploads'
  | 'Reciters'
  | 'Playlists'
  | 'Me'
  | 'Memorization'
  | 'Moderation'
  | 'Admin';

/** Cache-Control the handler sets on success. */
export type CachePolicy = 'static' | 'shared' | 'private' | 'none';

export interface EndpointDefinition {
  operationId: string;
  method: HttpMethod;
  /** Path relative to /api/v1, with OpenAPI-style {param} placeholders. */
  path: `/${string}`;
  auth: AuthRequirement;
  tag: Tag;
  summary: string;
  description?: string;
  params?: z.ZodObject;
  query?: z.ZodObject;
  body?: z.ZodType;
  successStatus: 200 | 201 | 204;
  /** Omitted only for 204 responses. */
  response?: z.ZodType;
  /**
   * Endpoint-specific errors. VALIDATION_ERROR, UNAUTHENTICATED, FORBIDDEN (for moderator/admin),
   * RATE_LIMITED and INTERNAL_ERROR are added automatically from the other fields.
   */
  errors: readonly ErrorCode[];
  rateLimit?: RateLimitName;
  cache: CachePolicy;
}

/** Identity function that keeps literal types, so clients can infer exact request/response types. */
export function defineEndpoint<const T extends EndpointDefinition>(definition: T): T {
  return definition;
}

type InputOf<T> = T extends z.ZodType ? z.input<T> : never;
type OutputOf<T> = T extends z.ZodType ? z.output<T> : never;

/** What a client sends. Keys with no schema are absent. */
export type EndpointRequest<E extends EndpointDefinition> = (E['params'] extends z.ZodObject
  ? { params: InputOf<E['params']> }
  : unknown) &
  (E['query'] extends z.ZodObject ? { query?: InputOf<E['query']> } : unknown) &
  (E['body'] extends z.ZodType ? { body: InputOf<E['body']> } : unknown);

/** What a client receives on success. */
export type EndpointResponse<E extends EndpointDefinition> = E['response'] extends z.ZodType
  ? OutputOf<E['response']>
  : undefined;
