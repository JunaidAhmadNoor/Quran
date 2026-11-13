'use client';
import type { HadithBookId, HadithSection } from '@tilawah/contracts';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { api } from '@/lib/api';
import { excerpt, type Piece } from './highlight';

type Section = z.output<typeof HadithSection>;

/** Search for a collection. While a search is active, its results replace the list of books. */
export function HadithBrowser({
  book,
  sections,
  children,
}: {
  book: z.output<typeof HadithBookId>;
  sections: Section[];
  children: ReactNode;
}) {
  const t = useTranslations('hadith');
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale);
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const query = useInfiniteQuery({
    queryKey: ['hadith-search', book, q],
    queryFn: ({ pageParam }) =>
      api.searchHadith({ params: { book }, query: { q, cursor: pageParam, limit: 20 } }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: q.length >= 2,
    staleTime: Infinity,
  });
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;
  const titles = new Map(sections.map((s) => [s.n, s.title]));
  const words = q.split(/\s+/).filter(Boolean);
  const clear = () => {
    setText('');
    setQ('');
  };

  /** The excerpt in the language the words were found in: page language first. */
  const pick = (
    h: (typeof items)[number],
  ): { pieces: Piece[]; lang: 'ar' | 'en' | 'ur' } | null => {
    const order: ('ar' | 'en' | 'ur')[] =
      locale === 'ur'
        ? ['ur', 'ar', 'en']
        : locale === 'ar'
          ? ['ar', 'en', 'ur']
          : ['en', 'ar', 'ur'];
    for (const lang of order) {
      const source = h.text[lang];
      const pieces = source ? excerpt(source, words) : null;
      if (pieces) return { pieces, lang };
    }
    const fallback = h.text.ar ?? h.text.en ?? h.text.ur ?? '';
    return fallback
      ? {
          pieces: [{ text: `${fallback.slice(0, 220)}…`, mark: false }],
          lang: h.text.ar ? 'ar' : 'en',
        }
      : null;
  };

  return (
    <div className="space-y-8">
      <form
        role="search"
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(text.trim());
        }}
      >
        <div className="relative flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted"
          />
          <Input
            type="search"
            aria-label={t('searchLabel')}
            placeholder={t('searchPlaceholder')}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (e.target.value === '') setQ('');
            }}
            className="ps-9"
          />
        </div>
        <Button type="submit" disabled={text.trim().length < 2}>
          {t('search')}
        </Button>
      </form>

      {q.length >= 2 ? (
        <section aria-labelledby="search-results" aria-busy={query.isFetching}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 id="search-results" className="font-display text-2xl text-text" aria-live="polite">
              {query.isFetched ? t('resultsCount', { count: total, q }) : t('search')}
            </h2>
            <Button variant="ghost" size="sm" onClick={clear}>
              <X />
              {t('clear')}
            </Button>
          </div>
          {query.isFetched && items.length === 0 ? (
            <p className="text-muted">{t('noResults')}</p>
          ) : null}
          <ol className="space-y-3">
            {items.map((h) => {
              const shown = pick(h);
              const href = `/hadith/${h.book}/n/${String(h.number)}`;
              return (
                <li
                  key={h.number}
                  className="rounded-card border border-border bg-surface p-4 transition-colors hover:border-primary/40"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <Link
                      href={href}
                      className="font-medium text-text underline-offset-4 hover:underline"
                    >
                      {t('hadithN', {
                        n: Number.isInteger(h.number) ? nf.format(h.number) : String(h.number),
                      })}
                    </Link>
                    <span className="text-xs text-muted">
                      {nf.format(h.section)}. <span lang="en">{titles.get(h.section)}</span>
                    </span>
                  </div>
                  {shown ? (
                    <p
                      lang={shown.lang}
                      dir={shown.lang === 'en' ? 'ltr' : 'rtl'}
                      className={
                        shown.lang === 'ar'
                          ? 'mt-2 font-quran text-xl leading-loose text-text'
                          : shown.lang === 'ur'
                            ? 'mt-2 font-[family-name:var(--font-nastaliq)] leading-[2.3] text-text'
                            : 'mt-2 leading-relaxed text-text'
                      }
                    >
                      {shown.pieces.map((p, i) =>
                        p.mark ? (
                          <mark key={i} className="rounded-[3px] bg-accent/25 px-0.5 text-text">
                            {p.text}
                          </mark>
                        ) : (
                          <span key={i}>{p.text}</span>
                        ),
                      )}
                    </p>
                  ) : null}
                  <Link
                    href={href}
                    className="mt-2 inline-block text-sm text-primary underline-offset-4 hover:underline"
                  >
                    {t('read')}
                  </Link>
                </li>
              );
            })}
          </ol>
          {query.hasNextPage ? (
            <div className="mt-4 text-center">
              <Button
                variant="secondary"
                onClick={() => void query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
              >
                {t('loadMore')}
              </Button>
            </div>
          ) : null}
        </section>
      ) : (
        children
      )}
    </div>
  );
}
