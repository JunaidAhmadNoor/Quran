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
    '@tilawah/ui-tokens',
  ],
  headers() {
    return Promise.resolve([{ source: '/:path*', headers: securityHeaders }]);
  },
};

export default createNextIntlPlugin('./i18n/request.ts')(config);
