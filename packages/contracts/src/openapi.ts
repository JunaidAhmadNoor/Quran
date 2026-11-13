// Builds the OpenAPI 3.1 document from the endpoint registry. Not exported from the package
// index so zod-openapi never ends up in a runtime bundle; the web app serves the generated JSON.
import {
  createDocument,
  type ZodOpenApiOperationObject,
  type ZodOpenApiPathsObject,
  type ZodOpenApiResponsesObject,
} from 'zod-openapi';
import type { EndpointDefinition } from './endpoint';
import { API_BASE_PATH, endpoints } from './endpoints';
import { ErrorResponse, errorDescriptions, errorStatus, type ErrorCode } from './errors';
import { rateLimits } from './limits';

export interface BuildOptions {
  version: string;
}

const SESSION_COOKIE = 'tilawah.session_token';

function implicitErrors(e: EndpointDefinition): ErrorCode[] {
  const codes: ErrorCode[] = ['INTERNAL_ERROR'];
  if (e.params ?? e.query ?? e.body) codes.push('VALIDATION_ERROR');
  if (e.auth !== 'public') codes.push('UNAUTHENTICATED');
  if (e.auth === 'moderator' || e.auth === 'admin') codes.push('FORBIDDEN');
  if (e.rateLimit) codes.push('RATE_LIMITED');
  return codes;
}

type StatusKey = `${1 | 2 | 3 | 4 | 5}${string}`;

function statusKey(status: number): StatusKey {
  return String(status) as StatusKey;
}

function buildResponses(e: EndpointDefinition): ZodOpenApiResponsesObject {
  const responses: ZodOpenApiResponsesObject = {};

  responses[statusKey(e.successStatus)] = e.response
    ? { description: 'Success', content: { 'application/json': { schema: e.response } } }
    : { description: 'Success, no content' };

  const byStatus = new Map<number, ErrorCode[]>();
  for (const code of new Set([...e.errors, ...implicitErrors(e)])) {
    const status = errorStatus[code];
    byStatus.set(status, [...(byStatus.get(status) ?? []), code]);
  }
  for (const [status, codes] of [...byStatus].sort(([a], [b]) => a - b)) {
    responses[statusKey(status)] = {
      description: codes.map((c) => `${c}: ${errorDescriptions[c]}`).join(' | '),
      content: { 'application/json': { schema: ErrorResponse } },
    };
  }
  return responses;
}

function buildOperation(e: EndpointDefinition): ZodOpenApiOperationObject {
  const operation: ZodOpenApiOperationObject = {
    operationId: e.operationId,
    summary: e.summary,
    tags: [e.tag],
    // Public endpoints accept an optional session; {} means "no auth" is allowed.
    security:
      e.auth === 'public'
        ? [{}, { cookieAuth: [] }, { bearerAuth: [] }]
        : [{ cookieAuth: [] }, { bearerAuth: [] }],
    responses: buildResponses(e),
    'x-auth': e.auth,
    'x-cache': e.cache,
  };
  if (e.description) operation.description = e.description;
  if (e.params ?? e.query) {
    operation.requestParams = {
      ...(e.params ? { path: e.params } : {}),
      ...(e.query ? { query: e.query } : {}),
    };
  }
  if (e.body) {
    operation.requestBody = {
      required: true,
      content: { 'application/json': { schema: e.body } },
    };
  }
  if (e.rateLimit) operation['x-rate-limit'] = { name: e.rateLimit, ...rateLimits[e.rateLimit] };
  return operation;
}

export function buildOpenApiDocument({ version }: BuildOptions) {
  const paths: ZodOpenApiPathsObject = {};
  const list: EndpointDefinition[] = Object.values(endpoints);
  for (const e of list) {
    const item = (paths[e.path] ??= {});
    const method = e.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
    item[method] = buildOperation(e);
  }

  return createDocument({
    openapi: '3.1.0',
    info: {
      title: 'Tilawah API',
      version,
      description:
        'Versioned REST API shared by the Tilawah website and mobile app. All responses are JSON. Errors use ErrorResponse. Authentication endpoints (sign-in, sign-up, sign-out, password reset, OAuth) are provided by Better Auth under /api/auth and are not part of this document.',
    },
    servers: [{ url: API_BASE_PATH }],
    tags: [
      { name: 'Health' },
      { name: 'Surahs' },
      { name: 'Hadith' },
      { name: 'Recitations' },
      { name: 'Uploads' },
      { name: 'Reciters' },
      { name: 'Playlists' },
      { name: 'Me' },
      { name: 'Memorization' },
      { name: 'Moderation' },
      { name: 'Admin' },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: SESSION_COOKIE,
          description:
            'Web only. HTTP-only, Secure, SameSite=Lax session cookie set by Better Auth.',
        },
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'Mobile. Session token from Better Auth (bearer plugin / Expo client).',
        },
      },
    },
    paths,
  });
}
