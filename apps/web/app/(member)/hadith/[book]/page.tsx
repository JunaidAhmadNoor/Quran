import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { HadithCredits } from '@/components/hadith/credits';
import { HadithBrowser } from '@/components/hadith/hadith-search';
import { getServerContext, sendStaffToWork } from '@/server/session';

interface Props {
  params: Promise<{ book: string }>;
}

async function load(id: string) {
  const { core } = await getServerContext();
  try {
    return core.hadith.getBook(id);
  } catch {
    notFound();
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const book = await load((await params).book);
  return { title: book.name.en };
}

export default async function HadithBookPage({ params }: Props) {
  await sendStaffToWork();
  const book = await load((await params).book);
  const t = await getTranslations('hadith');
  const locale = await getLocale();
  const nf = new Intl.NumberFormat(locale);
  const name = locale === 'ur' ? book.name.ur : locale === 'ar' ? book.name.ar : book.name.en;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p lang="ar" dir="rtl" className="font-quran text-3xl text-muted">
        {book.name.ar}
      </p>
      <h1 className="mt-1 font-display text-4xl text-text">{name}</h1>
      <p className="mt-2 mb-6 text-muted">
        {t('hadithCount', { count: book.hadithCount })} ·{' '}
        {t('bookCount', { count: book.sectionCount })}
      </p>
      <HadithBrowser book={book.id} sections={book.sections}>
        <section aria-labelledby="books">
          <h2 id="books" className="mb-4 font-display text-2xl text-text">
            {t('books')}
          </h2>
          <ol className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
            {book.sections.map((s) => (
              <li key={s.n}>
                <Link
                  href={`/hadith/${book.id}/${String(s.n)}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-surface-raised"
                >
                  <span className="w-10 shrink-0 text-center text-sm text-muted tabular-nums">
                    {nf.format(s.n)}
                  </span>
                  <span lang="en" className="flex-1 text-text">
                    {s.title}
                  </span>
                  <span className="text-xs text-muted">{t('hadithCount', { count: s.count })}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      </HadithBrowser>
      <HadithCredits source={book.source} />
    </div>
  );
}
