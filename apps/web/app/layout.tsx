import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { PlayerBar } from '@/components/player/player-bar';
import { Providers } from '@/components/layout/providers';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { themeScript } from '@/components/layout/theme';
import { directionOf } from '@/i18n/config';
import { getMeOrNull } from '@/server/session';
import { fontVariables } from './fonts';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common');
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
    title: { default: t('appName'), template: `%s · ${t('appName')}` },
    description: t('tagline'),
    openGraph: { type: 'website', siteName: t('appName'), description: t('tagline') },
    twitter: { card: 'summary_large_image' },
    applicationName: t('appName'),
    appleWebApp: { capable: true, title: t('appName'), statusBarStyle: 'default' },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F6F1E7' },
    { media: '(prefers-color-scheme: dark)', color: '#111714' },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const dir = directionOf(locale);
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const [me, t] = await Promise.all([getMeOrNull(), getTranslations('nav')]);

  return (
    <html lang={locale} dir={dir} className={fontVariables} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh bg-bg text-text">
        <NextIntlClientProvider>
          <Providers initialMe={me} dir={dir}>
            <a href="#main" className="skip-link">
              {t('skipToContent')}
            </a>
            <SiteHeader />
            <main id="main" className="min-h-[60vh] pb-16">
              {children}
            </main>
            <SiteFooter />
            <PlayerBar />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
