# @tilawah/api-client

A typed `fetch` client derived from the endpoint registry in `@tilawah/contracts`
(`endpoints`). There is no code generation step: request and response types are inferred
from the same Zod schemas the server validates with, so the client cannot drift from the API.

Implemented in **Phase 2**. Shape:

```ts
const api = createApiClient({ baseUrl, auth: { kind: 'cookie' } }); // web
const api = createApiClient({ baseUrl, auth: { kind: 'bearer', getToken } }); // mobile

const page = await api.listRecitations({ query: { surah: 1, sort: 'popular' } });
```

Errors come back as a typed `ApiError` carrying the `ErrorCode`. Uses only `fetch`, so it
runs in browsers, Node, and React Native.
