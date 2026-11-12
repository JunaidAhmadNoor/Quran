import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from '../src';

const json = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('createApiClient', () => {
  it('builds the URL from path params and query, and sends cookies', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json(200, { surah: {}, recitations: { items: [], nextCursor: null } }));
    const api = createApiClient({ baseUrl: 'https://api.test', fetch: fetchMock });
    await api.getSurah({ params: { n: 2 }, query: { sort: 'newest', limit: 5 } });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.test/api/v1/surahs/2?sort=newest&limit=5');
    expect(init).toMatchObject({ method: 'GET', credentials: 'include' });
  });

  it('sends a Bearer token and no cookies in bearer mode (mobile)', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(json(200, {}));
    const api = createApiClient({
      baseUrl: '',
      fetch: fetchMock,
      auth: { kind: 'bearer', getToken: () => 'tok' },
    });
    await api.getMe();
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.headers).toMatchObject({ authorization: 'Bearer tok' });
    expect(init?.credentials).toBe('omit');
  });

  it('sends JSON bodies and returns undefined for 204', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const api = createApiClient({ baseUrl: '', fetch: fetchMock });
    await expect(
      api.deletePlaylist({ params: { id: '665f1c2e9b1d4a0012ab34cd' } }),
    ).resolves.toBeUndefined();
    const created = vi.fn<typeof fetch>().mockResolvedValue(json(201, { id: 'x' }));
    await createApiClient({ baseUrl: '', fetch: created }).createPlaylist({
      body: { name: 'Fajr' },
    });
    expect(created.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', body: '{"name":"Fajr"}' });
  });

  it('throws ApiError with the server code, status and details', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      json(429, {
        error: { code: 'RATE_LIMITED', message: 'Slow down', details: { retryAfterSec: 9 } },
      }),
    );
    const api = createApiClient({ baseUrl: '', fetch: fetchMock });
    const error = await api.listSurahs().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
      details: { retryAfterSec: 9 },
    });
  });

  it('handles non-JSON error pages', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }));
    const error = await createApiClient({ baseUrl: '', fetch: fetchMock })
      .getHealth()
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'INTERNAL_ERROR', status: 502 });
  });

  it('refuses a missing path parameter', async () => {
    const api = createApiClient({ baseUrl: '', fetch: vi.fn<typeof fetch>() });
    // @ts-expect-error params are required by the contract
    await expect(api.getRecitation({})).rejects.toThrow(/Missing path parameter/);
  });
});
