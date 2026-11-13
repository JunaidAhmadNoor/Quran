import { describe, expect, it } from 'vitest';
import type { DomainError } from '../src/errors';
import { HadithService, searchable } from '../src/services/hadith';

const service = new HadithService();
const code = async (p: Promise<unknown> | (() => unknown)) => {
  try {
    await (typeof p === 'function' ? p() : p);
    return null;
  } catch (e) {
    return (e as DomainError).code;
  }
};

describe('HadithService', () => {
  it('lists both collections with their books and credits', () => {
    expect(service.listBooks().items.map((b) => b.id)).toEqual(['bukhari', 'muslim']);
    const bukhari = service.getBook('bukhari');
    expect(bukhari.name.en).toBe('Sahih al-Bukhari');
    expect(bukhari.sections[0]).toMatchObject({ n: 1, title: 'Revelation', first: 1 });
    expect(bukhari.source.translators.en).toBe('Muhammad Muhsin Khan');
    expect(service.getBook('muslim').source.translators.en).toBe('Abdul Hamid Siddiqui');
  });

  it('pages through a book (chapter) with all three languages', async () => {
    const first = await service.getSection('bukhari', 2, { limit: 20 });
    expect(first.section.title).toBe('Belief');
    expect(first.items).toHaveLength(20);
    expect(first.items[0]?.text.en).toBeTruthy();
    expect(first.items[0]?.text.ar).toBeTruthy();
    expect(first.nextCursor).not.toBeNull();
    const second = await service.getSection('bukhari', 2, {
      limit: 20,
      cursor: first.nextCursor ?? undefined,
    });
    expect(second.items[0]?.number).toBeGreaterThan(first.items.at(-1)?.number ?? 0);
  });

  it('finds one hadith by number and reports missing ones as not found', async () => {
    const h = await service.getHadith('bukhari', 1);
    expect(h).toMatchObject({ book: 'bukhari', number: 1, section: 1 });
    expect(await code(service.getHadith('bukhari', 99_999))).toBe('NOT_FOUND');
    expect(await code(() => service.getBook('tirmidhi'))).toBe('NOT_FOUND');
    expect(await code(service.getSection('muslim', 150, { limit: 20 }))).toBe('NOT_FOUND');
  });

  it(
    'searches Arabic without diacritics, English in any case, and Urdu',
    { timeout: 60_000 },
    async () => {
      const arabic = await service.search('bukhari', { q: 'انما الاعمال بالنيات', limit: 10 });
      expect(arabic.items.map((h) => h.number)).toContain(1);
      const english = await service.search('bukhari', { q: 'INTENTIONS', limit: 5 });
      expect(english.items.length).toBe(5);
      expect(english.nextCursor).not.toBeNull();
      expect(english.total).toBeGreaterThan(5);
      const urdu = await service.search('muslim', { q: 'نیت', limit: 5 });
      expect(urdu.items.length).toBeGreaterThan(0);
      expect((await service.search('bukhari', { q: 'zzqxqz', limit: 5 })).items).toEqual([]);
    },
  );

  it('treats a number as a hadith number', async () => {
    const res = await service.search('muslim', { q: '100', limit: 10 });
    expect(res.items.map((h) => h.number)).toEqual([100]);
  });

  it('normalizes text for search', () => {
    expect(searchable('إِنَّمَا الأَعْمَالُ')).toBe('انما الاعمال');
    expect(searchable('Intentions!')).toBe('intentions');
    expect(searchable('کتاب')).toBe('كتاب');
  });
});
