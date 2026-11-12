/** Object storage used for audio. R2 in production, an in-memory fake in tests. */
export interface StoragePort {
  presignPut(input: {
    key: string;
    contentType: string;
    sizeBytes: number;
    expiresInSec: number;
  }): Promise<{ url: string; headers: Record<string, string> }>;
  presignGet(input: { key: string; expiresInSec: number }): Promise<string>;
  head(key: string): Promise<{ sizeBytes: number; contentType: string | undefined } | null>;
  copy(fromKey: string, toKey: string): Promise<void>;
  delete(key: string): Promise<void>;
}
