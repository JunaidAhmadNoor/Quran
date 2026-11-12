'use client';
import type { RecitationSort } from '@tilawah/contracts';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { RecitationList } from '@/components/recitations/recitation-list';
import type { Page } from '@/components/recitations/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export type SurahView = 'recitations' | 'read';

/**
 * Recitations | Read. The views are separate URLs (?view=read) so the default page stays light
 * while the reading view is still fully server-rendered for search engines.
 */
export function SurahViewTabs({ surah, view }: { surah: number; view: SurahView }) {
  const t = useTranslations('surah');
  const tab = (v: SurahView, href: string) => (
    <Link
      href={href}
      scroll={false}
      aria-current={view === v ? 'page' : undefined}
      className={cn(
        '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-150',
        view === v ? 'border-primary text-text' : 'border-transparent text-muted hover:text-text',
      )}
    >
      {t(v)}
    </Link>
  );
  return (
    <nav aria-label={t('views')} className="flex gap-1 border-b border-border">
      {tab('recitations', `/surahs/${String(surah)}`)}
      {tab('read', `/surahs/${String(surah)}?view=read`)}
    </nav>
  );
}

export function SurahRecitations({ surah, initial }: { surah: number; initial: Page }) {
  const t = useTranslations('surah');
  const [sort, setSort] = useState<RecitationSort>('popular');
  const other = useQuery({
    queryKey: ['surah-first-page', surah, sort],
    queryFn: () => api.listRecitations({ query: { surah, sort, limit: 20 } }),
    enabled: sort !== 'popular',
  });
  const page = sort === 'popular' ? initial : other.data;

  if (initial.items.length === 0) {
    return (
      <EmptyState
        title={t('noRecitationsTitle')}
        body={t('noRecitationsBody')}
        action={
          <Button asChild>
            <Link href={`/upload?surah=${String(surah)}`}>{t('uploadCta')}</Link>
          </Button>
        }
      />
    );
  }
  return (
    <>
      <div
        role="radiogroup"
        aria-label={t('recitations')}
        className="mb-4 inline-flex rounded-control border border-border bg-surface p-0.5"
      >
        {(['popular', 'newest'] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={sort === s}
            onClick={() => setSort(s)}
            className={cn(
              'rounded-[4px] px-3 py-1 text-sm',
              sort === s ? 'bg-primary text-primary-contrast' : 'text-muted hover:text-text',
            )}
          >
            {t(s)}
          </button>
        ))}
      </div>
      {page ? (
        <RecitationList
          scope={`surah-${String(surah)}`}
          key={sort}
          initial={page}
          source={{ kind: 'recitations', surah, sort }}
          label={t('recitations')}
        />
      ) : null}
    </>
  );
}
