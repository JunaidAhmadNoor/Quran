// Typed fetch client derived from the endpoint registry. Runs in browsers, Node and React Native.
import {
  API_BASE_PATH,
  endpoints,
  type EndpointName,
  type EndpointRequest,
  type EndpointResponse,
  type Endpoints,
  type ErrorCode,
} from '@tilawah/contracts';

export class ApiError extends Error {
  constructor(
    /** An ErrorCode, or an unknown code from a newer server (treat by status). */
    readonly code: ErrorCode | (string & {}),
    readonly status: number,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type AuthMode =
  { kind: 'cookie' } | { kind: 'bearer'; getToken: () => string | null | Promise<string | null> };

export interface ApiClientOptions {
  /** Origin of the API, e.g. https://tilawah.up.railway.app. Empty string = same origin. */
  baseUrl: string;
  auth?: AuthMode;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
}

type Args<E extends Endpoints[EndpointName]> = keyof EndpointRequest<E> extends never
  ? [request?: EndpointRequest<E>]
  : [request: EndpointRequest<E>];

export type ApiClient = {
  [K in EndpointName]: (...args: Args<Endpoints[K]>) => Promise<EndpointResponse<Endpoints[K]>>;
};

interface RawRequest {
  params?: Record<string, string | number>;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

function buildUrl(baseUrl: string, path: string, request: RawRequest): string {
  const filled = path.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = request.params?.[key];
    if (value === undefined) throw new Error(`Missing path parameter "${key}"`);
    return encodeURIComponent(String(value));
  });
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(request.query ?? {})) {
    if (value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  return `${baseUrl}${API_BASE_PATH}${filled}${qs ? `?${qs}` : ''}`;
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  // Resolve fetch per call, so polyfills or test interceptors installed later are honoured.
  const doFetch: typeof fetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  const auth = options.auth ?? { kind: 'cookie' };

  const call = async (name: EndpointName, request: RawRequest = {}): Promise<unknown> => {
    const endpoint = endpoints[name];
    const headers: Record<string, string> = { accept: 'application/json', ...options.headers };
    if (request.body !== undefined) headers['content-type'] = 'application/json';
    if (auth.kind === 'bearer') {
      const token = await auth.getToken();
      if (token) headers.authorization = `Bearer ${token}`;
    }
    const response = await doFetch(buildUrl(options.baseUrl, endpoint.path, request), {
      method: endpoint.method,
      headers,
      credentials: auth.kind === 'cookie' ? 'include' : 'omit',
      ...(request.body !== undefined ? { body: JSON.stringify(request.body) } : {}),
    });
    if (response.status === 204) return undefined;
    const text = await response.text();
    let payload: unknown;
    try {
      payload = text ? JSON.parse(text) : undefined;
    } catch {
      throw new ApiError('INTERNAL_ERROR', response.status, 'The server returned invalid JSON');
    }
    if (!response.ok) {
      const error = (
        payload as
          | { error?: { code?: string; message?: string; details?: Record<string, unknown> } }
          | undefined
      )?.error;
      throw new ApiError(
        error?.code ?? 'INTERNAL_ERROR',
        response.status,
        error?.message ?? `HTTP ${response.status}`,
        error?.details ?? {},
      );
    }
    return payload;
  };

  const client: Record<string, (request?: RawRequest) => Promise<unknown>> = {};
  for (const name of Object.keys(endpoints) as EndpointName[]) {
    client[name] = (request) => call(name, request);
  }
  return client as unknown as ApiClient;
}
