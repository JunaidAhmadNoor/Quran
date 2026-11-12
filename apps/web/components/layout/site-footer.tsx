import { getTranslations } from 'next-intl/server';

export async function SiteFooter() {
  const t = await getTranslations('footer');
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto max-w-6xl space-y-1 px-4 py-8 text-xs text-muted">
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
        <p>{t('audio')}</p>
      </div>
    </footer>
  );
}
