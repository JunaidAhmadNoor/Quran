'use client';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { setShown, toggle, useShown } from './languages';

/** Arabic is always shown; English and Urdu can each be turned on or off. */
export function TranslationToggle() {
  const t = useTranslations('hadith');
  const shown = useShown(useLocale());
  return (
    <div role="group" aria-label={t('show')} className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted">{t('show')}</span>
      <span className="rounded-control border border-border bg-surface-raised px-3 py-1 text-text">
        {t('langArabic')}
      </span>
      {(['en', 'ur'] as const).map((lang) => (
        <button
          key={lang}
          type="button"
          aria-pressed={shown[lang]}
          onClick={() => setShown(toggle(shown.value, lang))}
          className={cn(
            'rounded-control border px-3 py-1 transition-colors',
            shown[lang]
              ? 'border-primary bg-primary text-primary-contrast'
              : 'border-border bg-surface text-muted hover:text-text',
          )}
        >
          {t(lang === 'en' ? 'langEnglish' : 'langUrdu')}
        </button>
      ))}
    </div>
  );
}
