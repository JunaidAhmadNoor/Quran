import type { MetadataRoute } from 'next';

/** Only the landing and legal pages are public; everything else needs an account. */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return {
    rules: { userAgent: '*', allow: ['/$', '/privacy', '/terms'], disallow: ['/'] },
    sitemap: `${base}/sitemap.xml`,
  };
}
