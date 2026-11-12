// next-intl without locale prefixes in URLs (the spec's routes are /surahs, not /en/surahs):
// the language comes from the NEXT_LOCALE cookie, then Accept-Language.
import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { LOCALE_COOKIE, defaultLocale, fromAcceptLanguage, isLocale } from './config';

export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale)
    ? cookieLocale
    : (fromAcceptLanguage((await headers()).get('accept-language') ?? '') ?? defaultLocale);
  const messages = (await import(`../messages/${locale}.json`)) as {
    default: Record<string, unknown>;
  };
  return { locale, messages: messages.default };
});
