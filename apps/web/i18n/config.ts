export const locales = ['en', 'ar', 'ur'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';
export const LOCALE_COOKIE = 'NEXT_LOCALE';

export const isLocale = (value: string | undefined): value is Locale =>
  value !== undefined && (locales as readonly string[]).includes(value);

export const directionOf = (locale: string): 'rtl' | 'ltr' =>
  locale === 'ar' || locale === 'ur' ? 'rtl' : 'ltr';

/** Picks the first supported language from an Accept-Language header. */
export function fromAcceptLanguage(header: string): Locale | undefined {
  for (const part of header.split(',')) {
    const tag = part.split(';')[0]?.trim().slice(0, 2).toLowerCase();
    if (isLocale(tag)) return tag;
  }
  return undefined;
}
