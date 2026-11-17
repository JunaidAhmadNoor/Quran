import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { endpoints, type EndpointDefinition } from '../src';
import { buildOpenApiDocument } from '../src/openapi';

const list: EndpointDefinition[] = Object.values(endpoints);
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  version: string;
};

describe('endpoint registry', () => {
  it('uses each registry key as the operationId', () => {
    for (const [key, e] of Object.entries(endpoints)) expect(e.operationId).toBe(key);
  });

  it('has no duplicate method + path pairs', () => {
    const pairs = list.map((e) => `${e.method} ${e.path}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it('declares exactly the path params that appear in the path', () => {
    for (const e of list) {
      const inPath = [...e.path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      const declared = Object.keys(e.params?.shape ?? {}).sort();
      expect(declared, e.operationId).toEqual(inPath);
    }
  });

  it('has a response schema for every non-204 endpoint and none for 204', () => {
    for (const e of list) {
      expect(e.response === undefined, e.operationId).toBe(e.successStatus === 204);
    }
  });

  it('never accepts a body on GET', () => {
    for (const e of list.filter((x) => x.method === 'GET'))
      expect(e.body, e.operationId).toBeUndefined();
  });

  it('rate-limits every public write and every upload', () => {
    for (const e of list.filter((x) => x.method !== 'GET')) {
      expect(e.rateLimit, e.operationId).toBeDefined();
    }
  });

  it('never caches authenticated responses in shared caches', () => {
    for (const e of list.filter((x) => x.auth !== 'public')) {
      expect(['private', 'none'], e.operationId).toContain(e.cache);
    }
  });

  it('covers every endpoint required by the product spec', () => {
    const required = [
      'GET /surahs',
      'GET /surahs/{n}',
      'GET /surahs/{n}/text',
      'GET /recitations',
      'GET /recitations/{id}',
      'POST /recitations/{id}/play',
      'POST /uploads/presign',
      'POST /recitations',
      'PATCH /recitations/{id}',
      'DELETE /recitations/{id}',
      'POST /recitations/{id}/like',
      'DELETE /recitations/{id}/like',
      'POST /recitations/{id}/report',
      'GET /reciters/{id}',
      'GET /playlists',
      'POST /playlists',
      'PATCH /playlists/{id}',
      'DELETE /playlists/{id}',
      'GET /me/library',
      'GET /moderation/queue',
      'POST /moderation/recitations/{id}/decision',
      'GET /health',
    ];
    const actual = new Set(list.map((e) => `${e.method} ${e.path}`));
    for (const r of required) expect(actual, r).toContain(r);
  });
});

describe('openapi.json', () => {
  const generated = `${JSON.stringify(buildOpenApiDocument({ version: pkg.version }), null, 2)}\n`;

  it('is committed and matches the contracts (run `pnpm openapi` if this fails)', () => {
    const committed = readFileSync(new URL('../openapi.json', import.meta.url), 'utf8');
    expect(committed).toBe(generated);
  });

  it('carries the contracts package version', () => {
    const doc = JSON.parse(generated) as { info: { version: string } };
    expect(doc.info.version).toBe(pkg.version);
  });

  it('documents ErrorResponse for every error status', () => {
    const doc = JSON.parse(generated) as {
      paths: Record<string, Record<string, { responses: Record<string, { content?: unknown }> }>>;
    };
    for (const item of Object.values(doc.paths)) {
      for (const op of Object.values(item)) {
        for (const [status, res] of Object.entries(op.responses)) {
          if (Number(status) >= 400) {
            expect(JSON.stringify(res.content)).toContain('#/components/schemas/ErrorResponse');
          }
        }
      }
    }
  });
});
