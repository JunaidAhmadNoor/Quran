import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { HadithCredits } from '@/components/hadith/credits';
import { HadithList } from '@/components/hadith/hadith-list';
import { TranslationToggle } from '@/components/hadith/translation-toggle';
import { getServerContext, sendStaffToWork } from '@/server/session';

interface Props {
  params: Promise<{ book: string; section: string }>;
}

async function load(id: string, sectionParam: string) {
  const { core } = await getServerContext();
  const n = Number(sectionParam);
  if (!Number.isInteger(n) || n < 0) notFound();
  try {
    const book = core.hadith.getBook(id);
    const page = await core.hadith.getSection(id, n, { limit: 20 });
    return { book, page };
  } catch {
    notFound();
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { book, section } = await params;
  const { book: b, page } = await load(book, section);
  return { title: `${page.section.title} · ${b.name.en}` };
}

export default async function HadithSectionPage({ params }: Props) {
  await sendStaffToWork();
  const { book: id, section } = await params;
  const { book, page } = await load(id, section);
  const t = await getTranslations('hadith');
  const nf = new Intl.NumberFormat(await getLocale());
  const index = book.sections.findIndex((s) => s.n === page.section.n);
  const prev = book.sections[index - 1];
  const next = book.sections[index + 1];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <nav aria-label={book.name.en} className="mb-4 text-sm">
        <Link
          href={`/hadith/${book.id}`}
          className="text-primary underline-offset-4 hover:underline"
        >
          {book.name.en}
        </Link>
      </nav>
      <h1 className="font-display text-3xl text-text">
        <span className="text-muted">{nf.format(page.section.n)}. </span>
        <span lang="en">{page.section.title}</span>
      </h1>
      <p className="mt-2 mb-6 text-muted">{t('hadithCount', { count: page.section.count })}</p>
      <div className="mb-6">
        <TranslationToggle />
      </div>
      <HadithList initial={page} bookName={book.name.en} />
      <nav className="mt-10 flex justify-between gap-4" aria-label={t('books')}>
        {prev ? (
          <Link
            href={`/hadith/${book.id}/${String(prev.n)}`}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <ChevronLeft aria-hidden className="size-4 rtl:rotate-180" />
            {t('previousBook')}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`/hadith/${book.id}/${String(next.n)}`}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            {t('nextBook')}
            <ChevronRight aria-hidden className="size-4 rtl:rotate-180" />
          </Link>
        ) : null}
      </nav>
      <HadithCredits source={book.source} />
    </div>
  );
}
