import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { HadithCredits } from '@/components/hadith/credits';
import { HadithCard } from '@/components/hadith/hadith-card';
import { TranslationToggle } from '@/components/hadith/translation-toggle';
import { getServerContext, sendStaffToWork } from '@/server/session';

interface Props {
  params: Promise<{ book: string; number: string }>;
}

async function load(id: string, numberParam: string) {
  const { core } = await getServerContext();
  const n = Number(numberParam);
  if (!Number.isFinite(n) || n <= 0) notFound();
  try {
    return { book: core.hadith.getBook(id), hadith: await core.hadith.getHadith(id, n) };
  } catch {
    notFound();
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { book, number } = await params;
  const { book: b, hadith } = await load(book, number);
  return { title: `${b.name.en} ${String(hadith.number)}` };
}

export default async function SingleHadithPage({ params }: Props) {
  await sendStaffToWork();
  const { book: id, number } = await params;
  const { book, hadith } = await load(id, number);
  const t = await getTranslations('hadith');
  const section = book.sections.find((s) => s.n === hadith.section);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <nav className="mb-4 flex flex-wrap gap-x-2 text-sm">
        <Link
          href={`/hadith/${book.id}`}
          className="text-primary underline-offset-4 hover:underline"
        >
          {book.name.en}
        </Link>
        {section ? (
          <>
            <span aria-hidden className="text-muted">
              /
            </span>
            <Link
              href={`/hadith/${book.id}/${String(section.n)}`}
              className="text-primary underline-offset-4 hover:underline"
            >
              {section.title}
            </Link>
          </>
        ) : null}
      </nav>
      <h1 className="mb-6 font-display text-3xl text-text">
        {book.name.en} · {t('hadithN', { n: String(hadith.number) })}
      </h1>
      <div className="mb-6">
        <TranslationToggle />
      </div>
      <HadithCard hadith={hadith} bookName={book.name.en} />
      <HadithCredits source={book.source} />
    </div>
  );
}
