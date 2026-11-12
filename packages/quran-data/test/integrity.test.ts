// Guards the rule that the Quran text can never change by accident.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import checksums from '../checksums.json' with { type: 'json' };
import {
  AYAH_COUNT,
  SURAH_COUNT,
  countWords,
  getSurahMeta,
  isValidAyahRange,
  loadSurahText,
  surahs,
  textSource,
} from '../src';
import { buildGeneratedFiles } from '../src/generate';
import { parseQuranText } from '../src/parse';

const root = new URL('..', import.meta.url);
const raw = (path: string) => readFileSync(new URL(path, root));
const sourceText = raw('source/quran-uthmani.txt').toString('utf8');
const sourceXml = raw('source/quran-data.xml').toString('utf8');
const sha256 = (buf: Buffer) => createHash('sha256').update(buf).digest('hex');

describe('source files', () => {
  it.each(Object.entries(checksums.files))('%s matches its committed SHA-256', (file, hash) => {
    expect(sha256(raw(`source/${file}`))).toBe(hash);
  });

  it('still carries the Tanzil copyright block', () => {
    expect(sourceText).toContain('Tanzil Quran Text (Uthmani, Version 1.1)');
    expect(sourceText).toContain('CHANGING IT IS NOT ALLOWED');
  });

  it('has 114 surahs and 6,236 ayahs', () => {
    const ayahs = parseQuranText(sourceText);
    expect(ayahs).toHaveLength(AYAH_COUNT);
    expect(new Set(ayahs.map((a) => a.surah)).size).toBe(SURAH_COUNT);
    expect(surahs).toHaveLength(SURAH_COUNT);
    expect(surahs.reduce((n, s) => n + s.ayahCount, 0)).toBe(AYAH_COUNT);
  });
});

describe('generated files', () => {
  const files = buildGeneratedFiles(sourceText, sourceXml);

  it('are committed and up to date', () => {
    for (const [path, content] of files) {
      expect(readFileSync(new URL(path, root), 'utf8'), path).toBe(content);
    }
  });

  it('reproduce every source line exactly (the derivation changes nothing)', async () => {
    const byKey = new Map(parseQuranText(sourceText).map((a) => [`${a.surah}:${a.ayah}`, a.text]));
    for (const meta of surahs) {
      const text = await loadSurahText(meta.number);
      for (const ayah of text.ayahs) {
        const rebuilt =
          ayah.number === 1 && text.bismillah !== null
            ? `${text.bismillah} ${ayah.text}`
            : ayah.text;
        expect(rebuilt).toBe(byKey.get(`${meta.number}:${ayah.number}`));
      }
    }
  });
});

describe('runtime API', () => {
  it('separates the bismillah except for surahs 1 and 9', async () => {
    const [fatiha, baqarah, tawbah] = await Promise.all([1, 2, 9].map((n) => loadSurahText(n)));
    expect(fatiha?.bismillah).toBeNull();
    expect(tawbah?.bismillah).toBeNull();
    expect(baqarah?.bismillah).toBe(fatiha?.ayahs[0]?.text);
    expect(baqarah?.ayahs[0]?.words.map((w) => w.position)).toEqual([1]);
  });

  it('keeps each surah’s own spelling of the bismillah (95 and 97 carry a shadda)', async () => {
    const [fatiha, tin, qadr] = await Promise.all([1, 95, 97].map((n) => loadSurahText(n)));
    const SHADDA = '\u0651';
    for (const surah of [tin, qadr]) {
      expect(surah?.bismillah?.split(' ')[0]).toContain(SHADDA);
      expect(surah?.bismillah).not.toBe(fatiha?.ayahs[0]?.text);
    }
  });

  it('excludes pause marks and signs from words but keeps them in the text', async () => {
    const baqarah = await loadSurahText(2);
    const ayah2 = baqarah.ayahs[1];
    expect(ayah2?.text).toContain('ۛ');
    expect(ayah2?.words.some((w) => w.text === 'ۛ')).toBe(false);
    expect(ayah2?.words).toHaveLength(7);
  });

  it('counts the words of Al-Ikhlas', async () => {
    expect(await countWords(112, 1, 4)).toBe(15);
  });

  it('exposes metadata', () => {
    expect(getSurahMeta(1)).toMatchObject({
      nameArabic: 'الفاتحة',
      ayahCount: 7,
      revelationPlace: 'meccan',
      juz: [1],
    });
    expect(getSurahMeta(2)?.juz).toEqual([1, 2, 3]);
    expect(getSurahMeta(115)).toBeUndefined();
    expect(textSource.sha256).toMatch(/^[a-f\d]{64}$/);
  });

  it.each([
    [1, 1, 7, true],
    [1, 0, 7, false],
    [1, 3, 2, false],
    [1, 1, 8, false],
    [2, 255, 257, true],
    [115, 1, 1, false],
  ])('isValidAyahRange(%i, %i, %i) → %s', (s, from, to, ok) => {
    expect(isValidAyahRange(s, from, to)).toBe(ok);
  });

  it('rejects unknown surahs', async () => {
    await expect(loadSurahText(0)).rejects.toThrow(RangeError);
  });
});
