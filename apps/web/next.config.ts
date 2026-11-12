import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Security headers for every response. Pages also get a per-request Content-Security-Policy
// with a script nonce from proxy.ts; this static one covers API and asset responses.
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' },
  // Cross-origin isolation lets on-device speech recognition use several CPU threads
  // (SharedArrayBuffer). "credentialless" still allows cross-origin images and audio, which are
  // loaded without cookies; browsers without it (Safari) ignore it and run single-threaded.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Always put metadata in <head> (no streaming), so every crawler and link preview sees it.
  htmlLimitedBots: /.*/,
  transpilePackages: [
    '@tilawah/api-client',
    '@tilawah/contracts',
    '@tilawah/core',
    '@tilawah/quran-data',
    '@tilawah/recitation',
    '@tilawah/ui-tokens',
  ],
  headers() {
    return Promise.resolve([{ source: '/:path*', headers: securityHeaders }]);
  },
};

export default createNextIntlPlugin('./i18n/request.ts')(config);
