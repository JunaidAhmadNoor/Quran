'use client';
import type { HadithSectionPage } from '@tilawah/contracts';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { HadithCard } from './hadith-card';

type Page = z.output<typeof HadithSectionPage>;

/** The hadith of one book, the first page server-rendered, then "Load more". */
export function HadithList({ initial, bookName }: { initial: Page; bookName: string }) {
  const t = useTranslations('hadith');
  const { book, section } = initial;
  const query = useInfiniteQuery({
    queryKey: ['hadith-section', book.id, section.n],
    queryFn: ({ pageParam }) =>
      api.getHadithSection({
        params: { book: book.id, section: section.n },
        query: { cursor: pageParam, limit: 20 },
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    initialData: { pages: [initial], pageParams: [undefined] },
    staleTime: Infinity,
  });
  const items = query.data.pages.flatMap((p) => p.items);
  return (
    <div className="space-y-4">
      {items.map((h) => (
        <HadithCard key={h.number} hadith={h} bookName={bookName} />
      ))}
      {query.hasNextPage ? (
        <div className="text-center">
          <Button
            variant="secondary"
            onClick={() => void query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            {t('loadMore')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
