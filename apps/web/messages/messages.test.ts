import { IntlMessageFormat } from 'intl-messageformat';
import { describe, expect, it } from 'vitest';
import ar from './ar.json';
import en from './en.json';
import ur from './ur.json';

interface Tree {
  [key: string]: string | Tree;
}
const flatten = (tree: Tree, prefix = ''): Record<string, string> =>
  Object.fromEntries(
    Object.entries(tree).flatMap(([k, v]) =>
      typeof v === 'string' ? [[`${prefix}${k}`, v]] : Object.entries(flatten(v, `${prefix}${k}.`)),
    ),
  );

const locales = { en: flatten(en), ar: flatten(ar), ur: flatten(ur) };

describe('UI messages', () => {
  it.each(['ar', 'ur'] as const)('%s has exactly the English keys', (locale) => {
    expect(Object.keys(locales[locale]).sort()).toEqual(Object.keys(locales.en).sort());
  });

  it.each(Object.keys(locales) as (keyof typeof locales)[])(
    'every %s message is valid ICU and formats',
    (locale) => {
      for (const [key, message] of Object.entries(locales[locale])) {
        const formatted = new IntlMessageFormat(message, locale).format({
          count: 3,
          n: 2,
          from: 1,
          to: 7,
          name: 'X',
          mode: 'X',
          query: 'X',
          reason: 'X',
          date: 'X',
          pct: 50,
          used: '1',
          quota: '2',
          duration: '0:05',
          size: 110,
          dataset: 'hadith-api',
          link: (chunks: unknown) => chunks,
          hadith: 1,
          book: 1,
          q: 'intentions',
          pending: 1,
          approved: 3,
          admins: 1,
          mods: 2,
          email: 'a@b.c',
          last: 4,
          done: 3,
          total: 15,
          correct: 12,
          heard: 3,
          expected: 1,
          year: 2026,
        });
        expect(String(formatted), `${locale}:${key}`).not.toBe('');
      }
    },
  );

  it('keeps placeholders consistent across languages', () => {
    const placeholders = (m: string) => [...m.matchAll(/\{(\w+)[,}]/g)].map((x) => x[1]).sort();
    for (const [key, message] of Object.entries(locales.en)) {
      for (const locale of ['ar', 'ur'] as const) {
        expect(new Set(placeholders(locales[locale][key] ?? '')), `${locale}:${key}`).toEqual(
          new Set(placeholders(message)),
        );
      }
    }
  });
});
