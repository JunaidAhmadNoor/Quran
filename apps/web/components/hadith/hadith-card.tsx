'use client';
import type { Hadith } from '@tilawah/contracts';
import { Check, Copy } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { useShown } from './languages';

type HadithItem = z.output<typeof Hadith>;

/** Number display: 402.2 stays as is; whole numbers in the page's digits. */
const formatNumber = (n: number, locale: string) =>
  Number.isInteger(n) ? new Intl.NumberFormat(locale).format(n) : String(n);

export function HadithCard({ hadith, bookName }: { hadith: HadithItem; bookName: string }) {
  const t = useTranslations('hadith');
  const locale = useLocale();
  const shown = useShown(locale);
  const [copied, setCopied] = useState(false);
  const number = formatNumber(hadith.number, locale);

  const copy = async () => {
    const parts = [
      hadith.text.ar,
      shown.en ? hadith.text.en : null,
      shown.ur ? hadith.text.ur : null,
      `— ${bookName} ${String(hadith.number)}`,
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(parts.join('\n\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: nothing to do.
    }
  };

  return (
    <article
      id={`h-${String(hadith.number)}`}
      aria-labelledby={`h-${String(hadith.number)}-title`}
      className="space-y-4 rounded-card border border-border bg-surface p-5 sm:p-6"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 id={`h-${String(hadith.number)}-title`} className="font-medium text-text">
            <Link
              href={`/hadith/${hadith.book}/n/${String(hadith.number)}`}
              className="underline-offset-4 hover:underline"
            >
              {t('hadithN', { n: number })}
            </Link>
          </h3>
          {hadith.reference.book > 0 ? (
            <span className="text-xs text-muted">
              {t('reference', {
                book: formatNumber(hadith.reference.book, locale),
                hadith: formatNumber(hadith.reference.hadith, locale),
              })}
            </span>
          ) : null}
          <span className="rounded-control border border-success/50 px-1.5 py-0.5 text-[0.7rem] font-medium text-success">
            {t('sahih')}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void copy()} aria-live="polite">
          {copied ? <Check /> : <Copy />}
          {copied ? t('copied') : t('copy')}
        </Button>
      </header>

      {hadith.text.ar ? (
        <p lang="ar" dir="rtl" className="font-quran text-[1.45rem] leading-[2.15] text-text">
          {hadith.text.ar}
        </p>
      ) : (
        <p className="text-sm text-muted">{t('noArabic')}</p>
      )}

      {shown.en ? (
        hadith.text.en ? (
          <p lang="en" dir="ltr" className="border-t border-border pt-4 leading-relaxed text-text">
            {hadith.text.en}
          </p>
        ) : (
          <p className="border-t border-border pt-4 text-sm text-muted">{t('noEnglish')}</p>
        )
      ) : null}

      {shown.ur ? (
        hadith.text.ur ? (
          <p
            lang="ur"
            dir="rtl"
            className="border-t border-border pt-4 font-[family-name:var(--font-nastaliq)] text-lg leading-[2.4] text-text"
          >
            {hadith.text.ur}
          </p>
        ) : (
          <p className="border-t border-border pt-4 text-sm text-muted">{t('noUrdu')}</p>
        )
      ) : null}
    </article>
  );
}
