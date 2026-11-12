'use client';
import { Languages, Monitor, Moon, Sun } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/menu';
import { LOCALE_COOKIE, locales, type Locale } from '@/i18n/config';
import { applyTheme, readTheme, subscribeTheme, type ThemeChoice } from './theme';

const LANGUAGE_NAMES: Record<Locale, string> = { en: 'English', ar: 'العربية', ur: 'اردو' };

export function LanguageMenu() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t('language')}>
          <Languages />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('language')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={locale}
          onValueChange={(value) => {
            document.cookie = `${LOCALE_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
            router.refresh();
          }}
        >
          {locales.map((l) => (
            <DropdownMenuRadioItem key={l} value={l} lang={l}>
              {LANGUAGE_NAMES[l]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ThemeMenu() {
  const t = useTranslations('nav');
  const theme = useSyncExternalStore(subscribeTheme, readTheme, (): ThemeChoice => 'system');
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t('theme')}>
          <Icon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('theme')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => applyTheme(value as ThemeChoice)}
        >
          <DropdownMenuRadioItem value="light">{t('themeLight')}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">{t('themeDark')}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">{t('themeSystem')}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
