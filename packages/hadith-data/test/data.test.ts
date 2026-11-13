import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOOK_IDS, books, isBookId, loadHadith, loadSection, sectionOf } from '../src';

const root = new URL('../generated/', import.meta.url);
const hashes = JSON.parse(readFileSync(new URL('HASHES.json', root), 'utf8')) as Record<
  string,
  string
>;

describe('hadith data integrity', () => {
  it('matches the hashes written by the generator (no hand edits of the texts)', () => {
    for (const [path, hash] of Object.entries(hashes)) {
      const content = readFileSync(new URL(path, root), 'utf8');
      expect(createHash('sha256').update(content).digest('hex'), path).toBe(hash);
    }
  });

  it('has both books with their chapters', () => {
    expect(BOOK_IDS).toEqual(['bukhari', 'muslim']);
    expect(books.bukhari.sections).toHaveLength(97);
    expect(books.muslim.sections).toHaveLength(57); // 56 books + the introduction
    expect(books.bukhari.hadithCount).toBeGreaterThan(7500);
    expect(books.muslim.hadithCount).toBeGreaterThan(7400);
    expect(isBookId('bukhari')).toBe(true);
    expect(isBookId('tirmidhi')).toBe(false);
  });

  for (const id of BOOK_IDS) {
    it(
      `${id}: every hadith appears once, in order, inside its chapter's range`,
      { timeout: 60_000 },
      async () => {
        const book = books[id];
        let previous = 0;
        let total = 0;
        for (const s of book.sections) {
          const file = await loadSection(id, s.n);
          expect(file?.hadiths).toHaveLength(s.count);
          for (const h of file?.hadiths ?? []) {
            expect(h.n).toBeGreaterThan(previous);
            expect(h.n).toBeGreaterThanOrEqual(s.first);
            expect(h.n).toBeLessThanOrEqual(s.last);
            expect(h.ar || h.en || h.ur).not.toBe('');
            previous = h.n;
          }
          total += s.count;
        }
        expect(total).toBe(book.hadithCount);
      },
    );
  }

  it('Sahih al-Bukhari 1 is the hadith of intentions, in all three languages', async () => {
    const h = await loadHadith('bukhari', 1);
    // Compared without diacritics (their order inside a letter varies between sources).
    expect(h?.ar.replace(/\p{Mn}/gu, '')).toContain('بالنيات');
    expect(h?.en).toContain('intentions');
    expect(h?.ur).toContain('نیت');
    expect(sectionOf('bukhari', 1)).toBe(1);
  });

  it('keeps sub-numbered hadith such as Bukhari 402.2', async () => {
    expect((await loadHadith('bukhari', 402.2))?.n).toBe(402.2);
  });

  it('returns null for chapters and hadith that do not exist', async () => {
    expect(loadSection('bukhari', 500)).toBeNull();
    expect(await loadHadith('muslim', 999_999)).toBeNull();
  });
});
