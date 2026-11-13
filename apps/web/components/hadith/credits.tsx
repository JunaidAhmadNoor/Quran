import type { HadithSource } from '@tilawah/contracts';
import { getTranslations } from 'next-intl/server';
import type { z } from 'zod';

/** Shown on every hadith page: where the texts come from and who translated them. */
export async function HadithCredits({ source }: { source: z.output<typeof HadithSource> }) {
  const t = await getTranslations('hadith');
  const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return (
    <aside
      aria-labelledby="hadith-credits"
      className="mt-12 rounded-card border border-border bg-surface p-5 text-sm text-muted"
    >
      <h2 id="hadith-credits" className="mb-2 font-medium text-text">
        {t('creditsTitle')}
      </h2>
      <p>
        {t.rich('creditsData', {
          dataset: source.dataset,
          link: (chunks) => (
            <a
              href={`${source.url}/tree/${source.commit}`}
              className="text-primary underline underline-offset-4"
              rel="noreferrer"
            >
              {chunks}
            </a>
          ),
        })}{' '}
        {t('creditsEnglish', { name: source.translators.en })} {t('creditsUrdu')}
      </p>
      {contact ? (
        <p className="mt-2">
          <a
            href={`mailto:${contact}?subject=Hadith%20rights`}
            className="text-primary underline underline-offset-4"
          >
            {t('creditsReport')}
          </a>
        </p>
      ) : null}
    </aside>
  );
}
