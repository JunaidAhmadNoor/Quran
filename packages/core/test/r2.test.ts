import {
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { afterEach, describe, expect, it } from 'vitest';
import { R2Storage, createR2Client } from '../src/storage/r2';

// Fake credentials: presigning is pure computation, and every send() is mocked.
const client = createR2Client({
  accountId: 'acc',
  accessKeyId: 'AKIDTEST',
  secretAccessKey: 'secret',
  bucket: 'b',
});
const s3 = mockClient(S3Client);
const storage = new R2Storage(client, 'tilawah-audio');

afterEach(() => s3.reset());

describe('R2Storage', () => {
  it('presigns a PUT for the R2 endpoint with size and type signed', async () => {
    const { url, headers } = await storage.presignPut({
      key: 'incoming/u/1.mp3',
      contentType: 'audio/mpeg',
      sizeBytes: 1234,
      expiresInSec: 600,
    });
    const parsed = new URL(url);
    expect(parsed.host).toBe('tilawah-audio.acc.r2.cloudflarestorage.com');
    expect(parsed.pathname).toBe('/incoming/u/1.mp3');
    expect(parsed.searchParams.get('X-Amz-Expires')).toBe('600');
    expect(parsed.searchParams.get('X-Amz-SignedHeaders')).toBe('content-length;content-type;host');
    expect(headers).toEqual({ 'Content-Type': 'audio/mpeg' });
  });

  it('presigns a GET', async () => {
    const url = new URL(await storage.presignGet({ key: 'audio/1.mp3', expiresInSec: 900 }));
    expect(url.pathname).toBe('/audio/1.mp3');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900');
  });

  it('returns size and type from HEAD, and null when the object is missing', async () => {
    s3.on(HeadObjectCommand, { Key: 'yes' }).resolves({
      ContentLength: 10,
      ContentType: 'audio/ogg',
    });
    s3.on(HeadObjectCommand, { Key: 'no' }).rejects(
      Object.assign(new Error('nf'), { name: 'NotFound' }),
    );
    expect(await storage.head('yes')).toEqual({ sizeBytes: 10, contentType: 'audio/ogg' });
    expect(await storage.head('no')).toBeNull();
  });

  it('propagates other HEAD failures', async () => {
    s3.on(HeadObjectCommand).rejects(new Error('boom'));
    await expect(storage.head('x')).rejects.toThrow('boom');
  });

  it('copies within the bucket and deletes', async () => {
    s3.on(CopyObjectCommand).resolves({});
    s3.on(DeleteObjectCommand).resolves({});
    await storage.copy('incoming/a.mp3', 'audio/a.mp3');
    await storage.delete('incoming/a.mp3');
    expect(s3.commandCalls(CopyObjectCommand)[0]?.args[0].input).toEqual({
      Bucket: 'tilawah-audio',
      Key: 'audio/a.mp3',
      CopySource: 'tilawah-audio/incoming/a.mp3',
    });
    expect(s3.commandCalls(DeleteObjectCommand)[0]?.args[0].input.Key).toBe('incoming/a.mp3');
  });
});
