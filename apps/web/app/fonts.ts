// Self-hosted at build time by next/font (no requests to Google at runtime), font-display: swap.
// The Quran face is Amiri Quran (SIL OFL) until the KFGQPC Hafs licence is confirmed; the CSS
// stack already lists "KFGQPC Uthmanic Script HAFS" first.
import {
  Amiri_Quran,
  Fraunces,
  IBM_Plex_Sans,
  IBM_Plex_Sans_Arabic,
  Noto_Nastaliq_Urdu,
} from 'next/font/google';

export const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex',
  display: 'swap',
});
export const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-arabic',
  display: 'swap',
  preload: false,
});
export const nastaliq = Noto_Nastaliq_Urdu({
  subsets: ['arabic'],
  weight: ['400', '600'],
  variable: '--font-nastaliq',
  display: 'swap',
  preload: false,
});
export const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
});
// Preloaded (45 KB): Quran text and surah names are the main content of most pages.
export const amiriQuran = Amiri_Quran({
  subsets: ['arabic'],
  weight: '400',
  variable: '--font-amiri-quran',
  display: 'swap',
});

export const fontVariables = [plex, plexArabic, nastaliq, fraunces, amiriQuran]
  .map((f) => f.variable)
  .join(' ');
