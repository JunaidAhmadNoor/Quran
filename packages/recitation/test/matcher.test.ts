import { loadSurahText } from '@tilawah/quran-data';
import { beforeAll, describe, expect, it } from 'vitest';
import { RecitationMatcher, expectedWordsFrom, type ExpectedWord, type MatcherEvent } from '../src';

let ikhlas: ExpectedWord[];
let fatiha: ExpectedWord[];

beforeAll(async () => {
  ikhlas = expectedWordsFrom((await loadSurahText(112)).ayahs);
  fatiha = expectedWordsFrom((await loadSurahText(1)).ayahs);
});

const revealed = (events: MatcherEvent[]) =>
  events.flatMap((e) => (e.type === 'revealed' ? [e.index] : []));

describe('RecitationMatcher', () => {
  it('reveals words recited exactly, in plain spelling, against the Uthmani text', () => {
    const m = new RecitationMatcher(ikhlas, 0);
    const events = m.hear(['قل هو الله احد'], 1000);
    expect(revealed(events)).toEqual([0, 1, 2, 3]);
    expect(m.wordStates.slice(0, 4)).toEqual(['correct', 'correct', 'correct', 'correct']);
    expect(m.nextIndex).toBe(4);
  });

  it('accepts small pronunciation differences', () => {
    const m = new RecitationMatcher(fatiha.slice(4), 0); // ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ …
    // "العالمين" (extra alef) is one edit from the Uthmani "العلمين".
    const events = m.hear(['الحمد', 'لله', 'رب', 'العالمين'], 1);
    expect(revealed(events)).toEqual([0, 1, 2, 3]);
  });

  it('reads the dagger alef as a full alef in short words, as recognizers write them', () => {
    // مَـٰلِكِ → "مالك" and صِرَٰطَ → "صراط": 0.75 similar without the alef, below the threshold.
    const m = new RecitationMatcher(
      fatiha.filter((w) => w.ayah >= 4),
      0,
    );
    const events = m.hear(
      ['مالك', 'يوم', 'الدين', 'اياك', 'نعبد', 'واياك', 'نستعين', 'اهدنا', 'الصراط'],
      1,
    );
    expect(revealed(events)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('still accepts the standard spelling without the alef (هَـٰذَا → هذا)', () => {
    const m = new RecitationMatcher(
      [
        { ayah: 1, position: 1, text: 'هَـٰذَا' },
        { ayah: 1, position: 2, text: 'ذَٰلِكَ' },
      ],
      0,
    );
    expect(revealed(m.hear(['هذا', 'ذلك'], 1))).toEqual([0, 1]);
  });

  it('catches up when recognition drops several words in a row (fast recitation)', () => {
    const m = new RecitationMatcher(ikhlas, 0);
    m.hear(['قل', 'هو'], 1);
    // "الله احد الله" were not recognized; the reciter is already at "الصمد لم".
    const events = m.hear(['الصمد', 'لم'], 2);
    expect(events).toContainEqual({ type: 'missed', indices: [2, 3, 4] });
    expect(revealed(events)).toEqual([5, 6]);
    expect(m.nextIndex).toBe(7);
    expect(revealed(m.hear(['يلد'], 3))).toEqual([7]);
  });

  it('does not jump ahead on a single misheard word', () => {
    const m = new RecitationMatcher(ikhlas, 0);
    m.hear(['قل', 'هو'], 1);
    expect(revealed(m.hear(['يلد'], 2))).toEqual([]); // matches word 8, but alone
    expect(m.nextIndex).toBe(2);
    expect(revealed(m.hear(['الله'], 3))).toEqual([2]); // back on track
  });

  it('rejects words that are too different', () => {
    const m = new RecitationMatcher(ikhlas, 0);
    expect(m.hear(['كتاب'], 1)).toEqual([{ type: 'ignored', heard: 'كتاب' }]);
    expect(m.nextIndex).toBe(0);
  });

  it('marks a skipped word as missed when a later word in the window is heard', () => {
    const m = new RecitationMatcher(ikhlas, 0);
    const events = m.hear(['قل', 'الله'], 1); // skipped هو
    expect(events).toContainEqual({ type: 'missed', indices: [1] });
    expect(m.wordStates.slice(0, 3)).toEqual(['correct', 'missed', 'correct']);
  });

  it('only looks three words ahead', () => {
    const m = new RecitationMatcher(ikhlas, 0);
    // أحد is the 4th word: outside the window of 3, so it is ignored.
    expect(revealed(m.hear(['احد'], 1))).toEqual([]);
    expect(m.wordStates[0]).toBe('hidden');
  });

  it('ignores a repeated word and coughs or isti‘adha', () => {
    const m = new RecitationMatcher(ikhlas, 0);
    m.hear(['قل', 'هو'], 1);
    const events = m.hear(['هو', 'اعوذ بالله من الشيطان الرجيم'], 2);
    expect(revealed(events)).toEqual([]);
    expect(m.nextIndex).toBe(2);
  });

  it('skips the bismillah said before a surah without misplacing words', () => {
    const m = new RecitationMatcher(ikhlas, 0); // window contains الله
    const events = m.hear(['بسم الله الرحمن الرحيم', 'قل'], 1);
    expect(revealed(events)).toEqual([0]);
    expect(m.wordStates.slice(0, 3)).toEqual(['correct', 'hidden', 'hidden']);
  });

  it('still matches أعوذ when it is the expected word (al-Falaq)', async () => {
    const falaq = expectedWordsFrom((await loadSurahText(113)).ayahs);
    const m = new RecitationMatcher(falaq, 0);
    expect(revealed(m.hear(['قل اعوذ برب الفلق'], 1))).toEqual([0, 1, 2, 3]);
  });

  it('detects recitation of the wrong ayah', () => {
    const m = new RecitationMatcher(ikhlas, 0);
    // Expected ayah 1 (قل هو الله أحد); the user starts ayah 3 (لم يلد ولم يولد).
    const events = m.hear(['لم', 'يلد', 'ولم'], 1);
    expect(events).toContainEqual({ type: 'wrong-ayah', expectedAyah: 1, heardAyah: 3 });
    expect(m.nextIndex).toBe(0);
  });

  it('detects the wrong ayah outside the range when given the surah as context', () => {
    const range = fatiha.filter((w) => w.ayah <= 2);
    const m = new RecitationMatcher(range, 0, { context: fatiha });
    const events = m.hear(['اياك', 'نعبد', 'واياك'], 1);
    expect(events).toContainEqual({ type: 'wrong-ayah', expectedAyah: 1, heardAyah: 5 });
  });

  it('offers a first-letter hint after 6 seconds, then the whole word', () => {
    const m = new RecitationMatcher(ikhlas, 0);
    expect(m.tick(5999)).toEqual([]);
    const first = m.tick(6000);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ type: 'hint', index: 0, level: 1 });
    expect(m.tick(11_999)).toEqual([]);
    expect(m.tick(12_000)[0]).toMatchObject({ type: 'hint', level: 2, text: ikhlas[0]?.text });
    expect(m.tick(20_000)).toEqual([]);
  });

  it('gives no hint while the user is still speaking or the recognizer is still working', () => {
    const m = new RecitationMatcher(ikhlas, 0);
    m.touch(4000); // speech heard until 4 s
    expect(m.tick(9999)).toEqual([]);
    expect(m.tick(10_000)[0]).toMatchObject({ type: 'hint', level: 1 });
    m.touch(3000); // an older activity never moves the clock back
    expect(m.tick(16_000)[0]).toMatchObject({ type: 'hint', level: 2 });
  });

  it('records a hinted word as a mistake and resets the timer on progress', () => {
    const m = new RecitationMatcher(ikhlas, 0);
    m.tick(6000);
    expect(m.hear(['قل'], 7000)).toContainEqual({ type: 'revealed', index: 0, state: 'hinted' });
    expect(m.tick(12_999)).toEqual([]);
    expect(m.tick(13_000)[0]).toMatchObject({ type: 'hint', index: 1, level: 1 });
  });

  it('completes and summarizes the session', () => {
    const m = new RecitationMatcher(ikhlas, 0);
    // يلد is skipped: after لم the user goes straight to ولم.
    const events = m.hear(['قل هو الله احد الله الصمد لم ولم يولد ولم يكن له كفوا احد'], 1);
    expect(events.at(-1)).toEqual({ type: 'complete' });
    expect(m.isComplete).toBe(true);
    expect(m.nextIndex).toBe(-1);
    expect(m.tick(60_000)).toEqual([]);
    expect(m.hear(['قل'], 2)).toEqual([]);
    expect(m.summary()).toEqual({
      wordsTotal: 15,
      wordsCorrect: 14,
      mistakes: [{ ayah: 3, word: 2, type: 'missed' }],
    });
  });

  it('refuses an empty range', () => {
    expect(() => new RecitationMatcher([], 0)).toThrow();
  });
});
