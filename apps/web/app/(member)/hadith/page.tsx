import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { GirihPattern } from '@/components/ui/ornaments';
import { getServerContext, sendStaffToWork } from '@/server/session';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('hadith');
  return { title: t('title'), description: t('intro') };
}

export default async function HadithPage() {
  await sendStaffToWork();
  const { core } = await getServerContext();
  const t = await getTranslations('hadith');
  const locale = await getLocale();
  const { items } = core.hadith.listBooks();
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-4xl text-text">{t('title')}</h1>
      <p className="mt-2 mb-8 text-muted">{t('intro')}</p>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {items.map((b) => (
          <li key={b.id}>
            <Link
              href={`/hadith/${b.id}`}
              className="group relative block overflow-hidden rounded-card border border-border bg-surface p-6 transition-colors hover:border-primary/50"
            >
              <GirihPattern className="opacity-[0.05]" />
              <span lang="ar" dir="rtl" className="relative block font-quran text-4xl text-text">
                {b.name.ar}
              </span>
              <span className="relative mt-3 block font-display text-xl text-text group-hover:underline">
                {locale === 'ur' ? b.name.ur : b.name.en}
              </span>
              <span className="relative mt-1 block text-sm text-muted">
                {t('hadithCount', { count: b.hadithCount })} ·{' '}
                {t('bookCount', { count: b.sectionCount })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
