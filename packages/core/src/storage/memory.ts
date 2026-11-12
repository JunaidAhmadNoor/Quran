import type { StoragePort } from './port';

/** In-memory StoragePort for tests and local development without R2. */
export class MemoryStorage implements StoragePort {
  readonly objects = new Map<string, { sizeBytes: number; contentType: string }>();
  failDeletes = false;

  /** Simulates the client's direct PUT to the presigned URL. */
  put(key: string, sizeBytes: number, contentType: string): void {
    this.objects.set(key, { sizeBytes, contentType });
  }

  presignPut(input: { key: string; contentType: string; expiresInSec: number }) {
    return Promise.resolve({
      url: `https://storage.test/${input.key}?expires=${input.expiresInSec}`,
      headers: { 'Content-Type': input.contentType },
    });
  }

  presignGet(input: { key: string; expiresInSec: number }) {
    return Promise.resolve(`https://storage.test/${input.key}?expires=${input.expiresInSec}`);
  }

  head(key: string) {
    return Promise.resolve(this.objects.get(key) ?? null);
  }

  copy(fromKey: string, toKey: string) {
    const object = this.objects.get(fromKey);
    if (!object) return Promise.reject(new Error(`No object ${fromKey}`));
    this.objects.set(toKey, { ...object });
    return Promise.resolve();
  }

  delete(key: string) {
    if (this.failDeletes) return Promise.reject(new Error('Storage unavailable'));
    this.objects.delete(key);
    return Promise.resolve();
  }
}
