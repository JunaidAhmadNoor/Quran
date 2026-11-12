import type { NextConfig } from 'next';

// Baseline security headers. The full Content-Security-Policy (R2 media/connect origins,
// wasm for the Phase 4 speech model) is added in Phase 3 once those origins are fixed.
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' },
];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
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

export default config;
