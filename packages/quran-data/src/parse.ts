// Pure parsing of the Tanzil source files. Used by the generator and by the integrity tests,
// never at runtime. Nothing here changes a character of the text: it only splits on the single
// spaces Tanzil already uses, and separates the bismillah prefix of ayah 1.

export interface SourceAyah {
  surah: number;
  ayah: number;
  text: string;
}

export interface SurahMeta {
  number: number;
  nameArabic: string;
  nameTransliterated: string;
  nameEnglish: string;
  ayahCount: number;
  revelationPlace: 'meccan' | 'medinan';
  revelationOrder: number;
  juz: number[];
}

/** What each generated/text/NNN.json file holds. */
export interface SurahTextFile {
  surah: number;
  /** Tokens of the bismillah separated from ayah 1, or null (surah 1 and 9). */
  bismillah: string[] | null;
  /** ayahs[i] holds the space-separated tokens of ayah i + 1, marks included. */
  ayahs: string[][];
}

export function parseQuranText(raw: string): SourceAyah[] {
  const ayahs: SourceAyah[] = [];
  for (const line of raw.split('\n')) {
    if (line === '' || line.startsWith('#')) continue;
    const match = /^(\d+)\|(\d+)\|(.+)$/.exec(line);
    if (!match) throw new Error(`Unexpected line in Quran text: ${line.slice(0, 40)}`);
    const [, surah, ayah, text] = match;
    ayahs.push({ surah: Number(surah), ayah: Number(ayah), text: text ?? '' });
  }
  return ayahs;
}

function attributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/(\w+)="([^"]*)"/g)) out[m[1] ?? ''] = m[2] ?? '';
  return out;
}

function intAttr(attrs: Record<string, string>, name: string): number {
  const value = Number(attrs[name]);
  if (!Number.isInteger(value)) throw new Error(`Missing integer attribute ${name}`);
  return value;
}

export function parseMetadata(xml: string): SurahMeta[] {
  const juzStarts = [...xml.matchAll(/<juz [^>]*\/>/g)].map((m) => {
    const a = attributes(m[0]);
    return { index: intAttr(a, 'index'), surah: intAttr(a, 'sura'), ayah: intAttr(a, 'aya') };
  });
  const key = (surah: number, ayah: number) => surah * 1000 + ayah;

  return [...xml.matchAll(/<sura [^>]*\/>/g)].map((m) => {
    const a = attributes(m[0]);
    const number = intAttr(a, 'index');
    const ayahCount = intAttr(a, 'ayas');
    const first = key(number, 1);
    const last = key(number, ayahCount);
    const juz = juzStarts
      .filter((j, i) => {
        const start = key(j.surah, j.ayah);
        const next = juzStarts[i + 1];
        const end = next ? key(next.surah, next.ayah) - 1 : Number.MAX_SAFE_INTEGER;
        return start <= last && end >= first;
      })
      .map((j) => j.index);
    const type = a.type;
    if (type !== 'Meccan' && type !== 'Medinan') throw new Error(`Unknown sura type ${type}`);
    return {
      number,
      nameArabic: a.name ?? '',
      nameTransliterated: a.tname ?? '',
      nameEnglish: a.ename ?? '',
      ayahCount,
      revelationPlace: type === 'Meccan' ? 'meccan' : 'medinan',
      revelationOrder: intAttr(a, 'order'),
      juz,
    };
  });
}

/** Letters only: drops combining marks (harakat, shadda, small high signs) for comparison. */
function skeleton(text: string): string {
  return text.normalize('NFD').replace(/\p{Mn}/gu, '');
}

export function buildSurahTextFiles(ayahs: SourceAyah[], meta: SurahMeta[]): SurahTextFile[] {
  const first = ayahs.find((a) => a.surah === 1 && a.ayah === 1);
  if (!first) throw new Error('Surah 1 ayah 1 missing');
  const reference = first.text.split(' ');
  const referenceSkeleton = skeleton(first.text);

  return meta.map((m) => {
    const rows = ayahs.filter((a) => a.surah === m.number);
    if (rows.length !== m.ayahCount) {
      throw new Error(`Surah ${m.number}: text has ${rows.length} ayahs, metadata ${m.ayahCount}`);
    }
    const hasPrefix = m.number !== 1 && m.number !== 9;
    let bismillah: string[] | null = null;
    const tokens = rows.map((row, i) => {
      if (row.ayah !== i + 1) throw new Error(`Surah ${m.number}: ayah order broken at ${i + 1}`);
      const all = row.text.split(' ');
      if (i === 0 && hasPrefix) {
        // Each surah keeps its own spelling (95 and 97 write بِّسْمِ with a shadda).
        const prefix = all.slice(0, reference.length);
        if (skeleton(prefix.join(' ')) !== referenceSkeleton) {
          throw new Error(`Surah ${m.number}: ayah 1 does not start with the bismillah`);
        }
        bismillah = prefix;
        return all.slice(reference.length);
      }
      return all;
    });
    return { surah: m.number, bismillah, ayahs: tokens };
  });
}
