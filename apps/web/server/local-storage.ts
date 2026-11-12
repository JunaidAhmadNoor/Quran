// Local-disk StoragePort for development and end-to-end tests when R2 is not configured.
// URLs are signed (HMAC) and expire, like R2's, and point at /api/dev-storage on this app.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, sep } from 'node:path';
import type { StoragePort } from '@tilawah/core';

interface Meta {
  contentType: string;
}

export class LocalDiskStorage implements StoragePort {
  constructor(
    private readonly root: string,
    private readonly baseUrl: string,
    private readonly secret: string,
  ) {}

  /** Resolves a key inside root, refusing path traversal. */
  path(key: string): string {
    const full = normalize(join(this.root, key));
    if (!full.startsWith(normalize(this.root) + sep)) throw new Error('Invalid storage key');
    return full;
  }

  private sign(method: string, key: string, exp: number, extra = ''): string {
    return createHmac('sha256', this.secret)
      .update(`${method}\n${key}\n${String(exp)}\n${extra}`)
      .digest('base64url');
  }

  private url(
    method: string,
    key: string,
    expiresInSec: number,
    extra: Record<string, string> = {},
  ): string {
    const exp = Date.now() + expiresInSec * 1000;
    const extraString = Object.entries(extra)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    const params = new URLSearchParams({
      ...extra,
      exp: String(exp),
      sig: this.sign(method, key, exp, extraString),
    });
    return `${this.baseUrl}/api/dev-storage/${key}?${params.toString()}`;
  }

  /** Checks a signed URL's method, expiry and signature. Returns the signed constraints. */
  verify(method: string, key: string, query: URLSearchParams): Record<string, string> | null {
    const exp = Number(query.get('exp'));
    const sig = query.get('sig') ?? '';
    if (!Number.isFinite(exp) || exp < Date.now()) return null;
    const extra: Record<string, string> = {};
    for (const k of ['ct', 'len']) {
      const v = query.get(k);
      if (v !== null) extra[k] = v;
    }
    const extraString = Object.entries(extra)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    const expected = Buffer.from(this.sign(method, key, exp, extraString));
    const actual = Buffer.from(sig);
    return expected.length === actual.length && timingSafeEqual(expected, actual) ? extra : null;
  }

  presignPut(input: { key: string; contentType: string; sizeBytes: number; expiresInSec: number }) {
    const url = this.url('PUT', input.key, input.expiresInSec, {
      ct: input.contentType,
      len: String(input.sizeBytes),
    });
    return Promise.resolve({ url, headers: { 'Content-Type': input.contentType } });
  }

  presignGet(input: { key: string; expiresInSec: number }) {
    return Promise.resolve(this.url('GET', input.key, input.expiresInSec));
  }

  async writeObject(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    const file = this.path(key);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, bytes);
    await writeFile(`${file}.meta.json`, JSON.stringify({ contentType } satisfies Meta));
  }

  async head(key: string) {
    try {
      const file = this.path(key);
      const [info, meta] = await Promise.all([stat(file), readFile(`${file}.meta.json`, 'utf8')]);
      return { sizeBytes: info.size, contentType: (JSON.parse(meta) as Meta).contentType };
    } catch {
      return null;
    }
  }

  readStream(key: string, range?: { start: number; end: number }) {
    return createReadStream(this.path(key), range);
  }

  async copy(fromKey: string, toKey: string): Promise<void> {
    const to = this.path(toKey);
    await mkdir(dirname(to), { recursive: true });
    await copyFile(this.path(fromKey), to);
    await copyFile(`${this.path(fromKey)}.meta.json`, `${to}.meta.json`);
  }

  async delete(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
    await rm(`${this.path(key)}.meta.json`, { force: true });
  }
}
