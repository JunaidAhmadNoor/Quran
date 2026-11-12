// Serves LocalDiskStorage objects (development and E2E only). With R2 configured this is a 404.
import { Readable } from 'node:stream';
import { getContainer } from '@/server/container';
import { LocalDiskStorage } from '@/server/local-storage';

interface Ctx {
  params: Promise<{ key: string[] }>;
}

async function local(): Promise<LocalDiskStorage | null> {
  const { storage } = await getContainer();
  return storage instanceof LocalDiskStorage ? storage : null;
}

const forbidden = () => new Response('Forbidden', { status: 403 });

export async function PUT(request: Request, { params }: Ctx) {
  const storage = await local();
  if (!storage) return new Response('Not found', { status: 404 });
  const key = (await params).key.join('/');
  const signed = storage.verify('PUT', key, new URL(request.url).searchParams);
  if (!signed) return forbidden();
  const contentType = request.headers.get('content-type') ?? '';
  if (signed.ct !== contentType) return forbidden();
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (signed.len !== String(bytes.byteLength)) return forbidden();
  await storage.writeObject(key, bytes, contentType);
  return new Response(null, { status: 200 });
}

export async function GET(request: Request, { params }: Ctx) {
  const storage = await local();
  if (!storage) return new Response('Not found', { status: 404 });
  const key = (await params).key.join('/');
  if (!storage.verify('GET', key, new URL(request.url).searchParams)) return forbidden();
  const head = await storage.head(key);
  if (!head) return new Response('Not found', { status: 404 });

  // Range requests let the audio element seek without downloading the whole file.
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '');
  const headers: Record<string, string> = {
    'Content-Type': head.contentType,
    'Accept-Ranges': 'bytes',
  };
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), head.sizeBytes - 1) : head.sizeBytes - 1;
    if (start > end)
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${String(head.sizeBytes)}` },
      });
    const stream = Readable.toWeb(storage.readStream(key, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: {
        ...headers,
        'Content-Range': `bytes ${String(start)}-${String(end)}/${String(head.sizeBytes)}`,
        'Content-Length': String(end - start + 1),
      },
    });
  }
  const stream = Readable.toWeb(storage.readStream(key)) as ReadableStream;
  return new Response(stream, {
    status: 200,
    headers: { ...headers, 'Content-Length': String(head.sizeBytes) },
  });
}
