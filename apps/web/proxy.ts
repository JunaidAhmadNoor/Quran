// Per-request Content-Security-Policy with a nonce for scripts (Next.js 16 "proxy", formerly
// middleware). Styles allow 'unsafe-inline' because React, Motion and Radix render style attributes.
import { NextResponse, type NextRequest } from 'next/server';

function r2Origins(): string {
  const publicBase = process.env.R2_PUBLIC_BASE_URL;
  return ['https://*.r2.cloudflarestorage.com', publicBase ? new URL(publicBase).origin : '']
    .filter(Boolean)
    .join(' ');
}

/** Where the speech model is downloaded from when it is not served by this app (see MEMORIZATION.md). */
function modelOrigin(): string {
  const base = process.env.NEXT_PUBLIC_SPEECH_MODEL_BASE_URL;
  return base ? new URL(base).origin : '';
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const dev = process.env.NODE_ENV === 'development';
  const r2 = r2Origins();
  const csp = [
    "default-src 'self'",
    // 'wasm-unsafe-eval': on-device speech recognition compiles WebAssembly (it cannot run JS).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://lh3.googleusercontent.com",
    `media-src 'self' blob: ${r2}`,
    `connect-src 'self' ${r2} ${modelOrigin()}`.trim(),
    "font-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(request.nextUrl.protocol === 'https:' ? ['upgrade-insecure-requests'] : []),
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      source:
        '/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|icons|manifest.webmanifest).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
