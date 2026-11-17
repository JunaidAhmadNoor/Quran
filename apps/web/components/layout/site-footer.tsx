import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { GirihPattern, StarMark } from '@/components/ui/ornaments';
import { getMeOrNull } from '@/server/session';

const linkClass = 'text-muted transition-colors hover:text-text';

export async function SiteFooter() {
  const t = await getTranslations('footer');
  const tc = await getTranslations('common');
  const tn = await getTranslations('nav');
  const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  const year = new Date().getFullYear();
  // Staff accounts have no listener pages (they are sent to /moderation).
  const role = (await getMeOrNull())?.role;
  const staff = role !== undefined && role !== 'user';

  return (
    <footer className="relative overflow-hidden border-t border-border bg-surface">
      <GirihPattern className="opacity-[0.03]" />
      <div className="relative mx-auto max-w-6xl px-4 py-12">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-[minmax(0,2fr)_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2 text-text">
              <StarMark className="size-7 text-accent" />
              <span className="font-display text-xl">{tc('appName')}</span>
            </Link>
            <p className="mt-3 max-w-sm text-sm text-muted">{tc('tagline')}.</p>
          </div>
          {staff ? (
            <div aria-hidden />
          ) : (
            <nav aria-labelledby="footer-explore">
              <h2 id="footer-explore" className="text-sm font-medium text-text">
                {t('explore')}
              </h2>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link href="/surahs" className={linkClass}>
                    {tn('surahs')}
                  </Link>
                </li>
                <li>
                  <Link href="/hadith" className={linkClass}>
                    {tn('hadith')}
                  </Link>
                </li>
                <li>
                  <Link href="/library" className={linkClass}>
                    {tn('library')}
                  </Link>
                </li>
              </ul>
            </nav>
          )}
          <nav aria-labelledby="footer-about">
            <h2 id="footer-about" className="text-sm font-medium text-text">
              {t('about')}
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/privacy" className={linkClass}>
                  {t('privacy')}
                </Link>
              </li>
              <li>
                <Link href="/terms" className={linkClass}>
                  {t('terms')}
                </Link>
              </li>
              {contact ? (
                <li>
                  <a href={`mailto:${contact}`} className={linkClass}>
                    {t('contact')}
                  </a>
                </li>
              ) : null}
            </ul>
          </nav>
        </div>

        <div className="mt-10 space-y-1 border-t border-border pt-6 text-xs text-muted">
          <p>
            {t('textSource')}{' '}
            <a
              href="https://tanzil.net"
              className="text-primary underline underline-offset-2"
              rel="noopener"
            >
              {t('tanzil')}
            </a>
          </p>
          <p>
            {t('hadithSource')}{' '}
            <a
              href="https://github.com/fawazahmed0/hadith-api"
              className="text-primary underline underline-offset-2"
              rel="noopener"
            >
              hadith-api
            </a>
          </p>
          <p>{t('audio')}</p>
          <p className="pt-2">{t('copyright', { year })}</p>
        </div>
      </div>
    </footer>
  );
}
