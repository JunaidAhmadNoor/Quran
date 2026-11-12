// The one wrapper every /api/v1 handler goes through. Handlers contain no rules: they call a
// service. This module only deals with HTTP: auth, CSRF/CORS, rate limits, parsing, errors.
import {
  errorStatus,
  type CachePolicy,
  type EndpointDefinition,
  type EndpointResponse,
  type ErrorCode,
} from '@tilawah/contracts';
import { DomainError, isAdmin, isStaff, type Actor, type Core } from '@tilawah/core';
import { ZodError, type z } from 'zod';
import { resolveActor } from './actor';
import { getContainer, type AppContainer } from './container';

type Parsed<T> = T extends z.ZodType ? z.output<T> : undefined;

export interface HandlerContext<E extends EndpointDefinition> {
  core: Core;
  config: AppContainer['config'];
  actor: Actor | null;
  /** user:<id> when signed in, otherwise a keyed hash of the client IP. */
  subject: string;
  params: Parsed<E['params']>;
  query: Parsed<E['query']>;
  body: Parsed<E['body']>;
}

export type Handler<E extends EndpointDefinition> = (
  ctx: HandlerContext<E>,
) => Promise<EndpointResponse<E>> | EndpointResponse<E>;

interface RouteContext {
  params: Promise<Record<string, string | string[] | undefined>>;
}

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const CACHE_HEADER: Record<CachePolicy, string> = {
  static: 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
  shared: 'public, s-maxage=60, stale-while-revalidate=300',
  private: 'private, no-store',
  none: 'no-store',
};

/** The proxy in front of the app appends the real client IP last. */
function clientIp(headers: Headers): string {
  const forwarded = headers
    .get('x-forwarded-for')
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return forwarded?.at(-1) ?? headers.get('x-real-ip') ?? 'unknown';
}

function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  if (!origin || !allowed.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '600',
  };
}

function errorBody(code: ErrorCode, message: string, details: Record<string, unknown> = {}) {
  return { error: { code, message, details } };
}

function toErrorResponse(error: unknown, headers: Record<string, string>): Response {
  if (error instanceof DomainError) {
    const extra: Record<string, string> = { ...headers };
    const retry = error.details.retryAfterSec;
    if (error.code === 'RATE_LIMITED' && typeof retry === 'number')
      extra['Retry-After'] = String(retry);
    return Response.json(errorBody(error.code, error.message, error.details), {
      status: errorStatus[error.code],
      headers: extra,
    });
  }
  if (error instanceof ZodError) {
    const issues = error.issues.map((i) => ({ path: i.path, message: i.message }));
    return Response.json(errorBody('VALIDATION_ERROR', 'The request is invalid', { issues }), {
      status: 400,
      headers,
    });
  }
  console.error('Unhandled API error', error instanceof Error ? error.stack : error);
  return Response.json(errorBody('INTERNAL_ERROR', 'Something went wrong'), {
    status: 500,
    headers,
  });
}

async function readBody(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    throw new DomainError('VALIDATION_ERROR', 'Send the body as application/json', {
      issues: [{ path: [], message: 'Content-Type must be application/json' }],
    });
  }
  try {
    return await request.json();
  } catch {
    throw new DomainError('VALIDATION_ERROR', 'The body is not valid JSON', {
      issues: [{ path: [], message: 'Malformed JSON' }],
    });
  }
}

export function route<E extends EndpointDefinition>(endpoint: E, handler: Handler<E>) {
  return async (request: Request, context: RouteContext): Promise<Response> => {
    let cors: Record<string, string> = {};
    try {
      const c = await getContainer();
      const origin = request.headers.get('origin');
      cors = corsHeaders(origin, c.config.allowedOrigins);
      const usesBearer = request.headers.get('authorization')?.startsWith('Bearer ') ?? false;

      // CSRF: a cookie-authenticated write must come from an allowed origin.
      if (UNSAFE.has(request.method) && !usesBearer && request.headers.has('cookie')) {
        if (!origin || !c.config.allowedOrigins.includes(origin)) {
          throw new DomainError('FORBIDDEN', 'Cross-site request blocked');
        }
      }

      const actor = await resolveActor(c, request.headers);
      if (endpoint.auth !== 'public' && !actor)
        throw new DomainError('UNAUTHENTICATED', 'Sign in to do this');
      if (endpoint.auth === 'moderator' && !isStaff(actor))
        throw new DomainError('FORBIDDEN', 'Moderators only');
      if (endpoint.auth === 'admin' && !isAdmin(actor))
        throw new DomainError('FORBIDDEN', 'Admins only');

      const subject = actor
        ? `user:${actor.userId}`
        : c.core.hashIp(clientIp(request.headers), c.config.ipHashSecret);
      if (endpoint.rateLimit) await c.core.rateLimiter.consume(endpoint.rateLimit, subject);

      const url = new URL(request.url);
      const params = endpoint.params ? endpoint.params.parse(await context.params) : undefined;
      const query = endpoint.query
        ? endpoint.query.parse(Object.fromEntries(url.searchParams))
        : undefined;
      const body = endpoint.body ? endpoint.body.parse(await readBody(request)) : undefined;

      const result = await handler({
        core: c.core,
        config: c.config,
        actor,
        subject,
        params: params as Parsed<E['params']>,
        query: query as Parsed<E['query']>,
        body: body as Parsed<E['body']>,
      });

      // Contract check outside production: a handler can never drift from its schema unnoticed.
      if (!c.config.production && endpoint.response) endpoint.response.parse(result);

      const cache =
        endpoint.cache === 'shared' && actor ? CACHE_HEADER.private : CACHE_HEADER[endpoint.cache];
      const headers = { ...cors, 'Cache-Control': cache, Vary: 'Cookie, Authorization, Origin' };
      if (endpoint.successStatus === 204) return new Response(null, { status: 204, headers });
      return Response.json(result, { status: endpoint.successStatus, headers });
    } catch (error) {
      return toErrorResponse(error, { ...cors, 'Cache-Control': 'no-store' });
    }
  };
}

/** CORS preflight for browsers on other allowed origins. Native apps never send it. */
export async function preflight(request: Request): Promise<Response> {
  const c = await getContainer();
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request.headers.get('origin'), c.config.allowedOrigins),
  });
}
