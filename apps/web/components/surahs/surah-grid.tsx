'use client';
import { normalizeArabic, surahs } from '@tilawah/quran-data';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { StarFrame } from '@/components/ui/ornaments';
import { EmptyState } from '@/components/ui/states';
import { cn, mushafNumber } from '@/lib/utils';

type Place = 'all' | 'meccan' | 'medinan';

/** Reads surah metadata from the bundled package instead of props, so it is not sent twice. */
export function SurahGrid() {
  const t = useTranslations('surahs');
  const tc = useTranslations('common');
  const [query, setQuery] = useState('');
  const [place, setPlace] = useState<Place>('all');
  const [juz, setJuz] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const arabic = normalizeArabic(query);
    return surahs.filter((s) => {
      if (place !== 'all' && s.revelationPlace !== place) return false;
      if (juz && !s.juz.includes(juz)) return false;
      if (!q) return true;
      return (
        String(s.number) === q ||
        s.nameTransliterated.toLowerCase().includes(q) ||
        s.nameEnglish.toLowerCase().includes(q) ||
        (arabic !== '' && normalizeArabic(s.nameArabic).includes(arabic))
      );
    });
  }, [query, place, juz]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="sr-only" htmlFor="surah-search">
          {t('search')}
        </label>
        <Input
          id="surah-search"
          type="search"
          placeholder={t('search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-xs"
        />
        <div
          role="radiogroup"
          aria-label={t('all')}
          className="inline-flex rounded-control border border-border bg-surface p-0.5"
        >
          {(['all', 'meccan', 'medinan'] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={place === p}
              onClick={() => setPlace(p)}
              className={cn(
                'rounded-[4px] px-3 py-1.5 text-sm',
                place === p ? 'bg-primary text-primary-contrast' : 'text-muted hover:text-text',
              )}
            >
              {p === 'all' ? t('all') : p === 'meccan' ? t('makki') : t('madani')}
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="juz">
          {t('juz')}
        </label>
        <Select
          id="juz"
          value={juz}
          onChange={(e) => setJuz(Number(e.target.value))}
          className="sm:w-40"
        >
          <option value={0}>{t('anyJuz')}</option>
          {Array.from({ length: 30 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {t('juzN', { n: i + 1 })}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={t('noResults', { query })}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQuery('');
                setPlace('all');
                setJuz(0);
              }}
            >
              {t('clear')}
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <li key={s.number}>
              <Link
                href={`/surahs/${s.number}`}
                className="group flex items-center gap-4 rounded-card border border-border bg-surface p-4 transition-colors duration-150 hover:border-primary/40 hover:bg-surface-raised"
              >
                <span className="relative flex size-11 shrink-0 items-center justify-center font-sans text-xs font-semibold text-text tabular-nums">
                  <StarFrame className="absolute inset-0 size-full text-accent transition-transform duration-300 group-hover:rotate-45 motion-reduce:transition-none" />
                  <span className="relative">{s.number}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-lg text-text">
                    {s.nameTransliterated}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {s.nameEnglish} · {tc('ayahs', { count: s.ayahCount })} ·{' '}
                    {s.revelationPlace === 'meccan' ? t('makki') : t('madani')}
                  </span>
                </span>
                <span
                  lang="ar"
                  dir="rtl"
                  className="shrink-0 font-quran text-2xl text-text"
                  title={mushafNumber(s.number)}
                >
                  {s.nameArabic}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
