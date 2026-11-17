import { getTranslations } from 'next-intl/server';
import { StarMark } from '@/components/ui/ornaments';

const SECTIONS = ['s1', 's2', 's3', 's4', 's5', 's6'] as const;

/** Privacy policy and terms of use: public pages, written from the messages files. */
export async function LegalPage({ doc }: { doc: 'privacy' | 'terms' }) {
  const t = await getTranslations(`legal.${doc}`);
  const tl = await getTranslations('legal');
  const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <header className="border-b border-border pb-8">
        <StarMark className="size-8 text-accent" />
        <h1 className="mt-4 font-display text-4xl text-text">{t('title')}</h1>
        <p className="mt-2 text-sm text-muted">{tl('updated')}</p>
        <p className="mt-6 text-lg text-muted">{t('intro')}</p>
      </header>
      <ol className="mt-8 space-y-8">
        {SECTIONS.map((s, i) => (
          <li key={s} className="flex gap-4">
            <span
              aria-hidden
              className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
            >
              {i + 1}
            </span>
            <section>
              <h2 className="font-display text-xl text-text">{t(`${s}Title`)}</h2>
              <p className="mt-2 leading-relaxed text-muted">{t(`${s}Body`)}</p>
            </section>
          </li>
        ))}
      </ol>
      {contact ? (
        <p className="mt-10 border-t border-border pt-6 text-sm text-muted">
          {tl.rich('contactLine', {
            email: contact,
            link: (chunks) => (
              <a href={`mailto:${contact}`} className="text-primary underline underline-offset-4">
                {chunks}
              </a>
            ),
          })}
        </p>
      ) : null}
    </article>
  );
}
