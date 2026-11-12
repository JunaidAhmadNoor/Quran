// The browser's API client: same origin, session cookie. The mobile app uses the same package
// with { kind: 'bearer' }. The origin is explicit because not every fetch accepts relative URLs.
import { createApiClient } from '@tilawah/api-client';

export const api = createApiClient({
  baseUrl: typeof window === 'undefined' ? '' : window.location.origin,
});
export { ApiError } from '@tilawah/api-client';
