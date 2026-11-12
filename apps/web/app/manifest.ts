import type { MetadataRoute } from 'next';

/** Installable before the native app exists. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Tilawah — Quran recitations',
    short_name: 'Tilawah',
    description: 'Listen to, share and memorize the recitation of the Quran.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F6F1E7',
    theme_color: '#1E4D45',
    icons: [
      { src: '/icons/192', sizes: '192x192', type: 'image/png' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
