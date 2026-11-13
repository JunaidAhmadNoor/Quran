'use client';
// Which translations to show under the Arabic, remembered in this browser. Before the browser
// value is read (server render), the default follows the page language.
import { useSyncExternalStore } from 'react';

export type Shown = 'en' | 'ur' | 'en+ur' | 'none';
const KEY = 'tilawah.hadith.translations';
const EVENT = 'tilawah-hadith-translations';

export const defaultShown = (locale: string): Shown =>
  locale === 'ur' ? 'ur' : locale === 'ar' ? 'none' : 'en';

function read(): Shown | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'en' || v === 'ur' || v === 'en+ur' || v === 'none' ? v : null;
  } catch {
    return null;
  }
}

export function setShown(value: Shown): void {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    // Storage unavailable: the choice lasts for this page only.
  }
  window.dispatchEvent(new Event(EVENT));
}

const subscribe = (cb: () => void) => {
  window.addEventListener('storage', cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener('storage', cb);
    window.removeEventListener(EVENT, cb);
  };
};

export function useShown(locale: string): { en: boolean; ur: boolean; value: Shown } {
  const fallback = defaultShown(locale);
  const value = useSyncExternalStore(
    subscribe,
    () => read() ?? fallback,
    () => fallback,
  );
  return {
    en: value === 'en' || value === 'en+ur',
    ur: value === 'ur' || value === 'en+ur',
    value,
  };
}

export function toggle(value: Shown, lang: 'en' | 'ur'): Shown {
  const en = value === 'en' || value === 'en+ur';
  const ur = value === 'ur' || value === 'en+ur';
  const next = lang === 'en' ? { en: !en, ur } : { en, ur: !ur };
  return next.en && next.ur ? 'en+ur' : next.en ? 'en' : next.ur ? 'ur' : 'none';
}
