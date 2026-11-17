// Per-request Content-Security-Policy with a nonce for scripts (Next.js 16 "proxy", formerly
// middleware). Styles allow 'unsafe-inline' because React, Motion and Radix render style attributes.
import { NextResponse, type NextRequest } from 'next/server';

function r2Origins(): string {
  const publicBase = process.env.R2_PUBLIC_BASE_URL;
  return ['https://*.r2.cloudflarestorage.com', publicBase ? new URL(publicBase).origin : '']
    .filter(Boolean)
    .join(' ');
}

/** Pages anyone may open; everything else needs an account. */
const PUBLIC_PAGES = [/^\/$/, /^\/auth(\/|$)/, /^\/(privacy|terms|opengraph-image)$/];
/** Static files served from public/ (icons and other assets). */
const ASSET = /\.[a-z0-9]+$/i;
const SESSION_COOKIES = ['tilawah.session_token', '__Secure-tilawah.session_token'];

/**
 * A quick gate: without a session cookie, member pages redirect to sign-in and come back after.
 * The member layout verifies the session itself, and every content API requires sign-in.
 */
function signInRedirect(request: NextRequest): NextResponse | null {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PAGES.some((p) => p.test(pathname)) || ASSET.test(pathname)) return null;
  if (SESSION_COOKIES.some((name) => request.cookies.has(name))) return null;
  const url = request.nextUrl.clone();
  url.pathname = '/auth/sign-in';
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export function proxy(request: NextRequest) {
  const gate = signInRedirect(request);
  if (gate) return gate;
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const dev = process.env.NODE_ENV === 'development';
  const r2 = r2Origins();
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://lh3.googleusercontent.com",
    `media-src 'self' blob: ${r2}`,
    `connect-src 'self' ${r2}`,
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
  // For the member layout's sign-in redirect (layouts do not receive the path).
  requestHeaders.set('x-pathname', request.nextUrl.pathname + request.nextUrl.search);
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
