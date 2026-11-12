// Integration-test harness: real route files, real services, in-memory MongoDB and storage.
// Auth is faked: `Authorization: Bearer test:<userId>` signs in as that user.
import {
  endpoints,
  type EndpointName,
  type EndpointResponse,
  type Endpoints,
  type ErrorResponse,
} from '@tilawah/contracts';
import { startTestCore, type TestCore } from '@tilawah/core/testing';
import { setContainer } from '@/server/container';

export const ORIGIN = 'http://localhost:3000';

type RouteModule = Record<
  string,
  (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>
>;

const modules = import.meta.glob<RouteModule>('../app/api/v1/**/route.ts');

/** "/recitations/{id}/like" → "../app/api/v1/recitations/[id]/like/route.ts" */
const fileFor = (path: string) => `../app/api/v1${path.replace(/\{(\w+)\}/g, '[$1]')}/route.ts`;

export async function startApp(): Promise<TestCore> {
  const t = await startTestCore();
  setContainer({
    core: t.core,
    auth: null,
    database: t.db.database,
    storage: t.storage,
    config: {
      allowedOrigins: [ORIGIN],
      ipHashSecret: 'test-ip-secret-test-ip-secret-1234',
      apiVersion: '1.0.0',
      production: false,
    },
    resolveSession: (headers) => {
      const match = /^Bearer test:([a-f\d]{24})$/.exec(headers.get('authorization') ?? '');
      return Promise.resolve(
        match?.[1] ? { userId: match[1], sessionCreatedAt: t.clock.now() } : null,
      );
    },
  });
  return t;
}

export interface CallOptions {
  params?: Record<string, string | number>;
  query?: Record<string, string | number>;
  body?: unknown;
  /** User id to sign in as. */
  as?: string;
  headers?: Record<string, string>;
}

export interface CallResult<K extends EndpointName> {
  status: number;
  headers: Headers;
  /** The success body, typed by the endpoint's contract (route() has already validated it). */
  json: EndpointResponse<Endpoints[K]>;
  /** The error object when status >= 400, otherwise null. */
  error: ErrorResponse['error'] | null;
}

export async function call<K extends EndpointName>(
  name: K,
  options: CallOptions = {},
): Promise<CallResult<K>> {
  const endpoint = endpoints[name];
  const load = modules[fileFor(endpoint.path)];
  if (!load) throw new Error(`No route file for ${endpoint.path}`);
  const handler = (await load())[endpoint.method];
  if (!handler) throw new Error(`${endpoint.path} does not export ${endpoint.method}`);

  const params = Object.fromEntries(
    Object.entries(options.params ?? {}).map(([k, v]) => [k, String(v)]),
  );
  const path = endpoint.path.replace(/\{(\w+)\}/g, (_, k: string) => params[k] ?? '');
  const url = new URL(`http://localhost/api/v1${path}`);
  for (const [k, v] of Object.entries(options.query ?? {})) url.searchParams.set(k, String(v));

  const headers = new Headers(options.headers);
  if (options.as) headers.set('authorization', `Bearer test:${options.as}`);
  if (options.body !== undefined) headers.set('content-type', 'application/json');

  const response = await handler(
    new Request(url, {
      method: endpoint.method,
      headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    }),
    { params: Promise.resolve(params) },
  );
  const text = await response.text();
  const parsed: unknown = text ? JSON.parse(text) : undefined;
  const failed = response.status >= 400;
  return {
    status: response.status,
    headers: response.headers,
    json: (failed ? undefined : parsed) as EndpointResponse<Endpoints[K]>,
    error: failed ? (parsed as ErrorResponse).error : null,
  };
}

export { fileFor, modules };
