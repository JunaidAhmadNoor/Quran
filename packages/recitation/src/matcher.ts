// Hidden-text recitation matcher. Pure and deterministic: the caller passes heard words and
// the current time, so the same logic runs on web and mobile and is fully unit-testable.
import { normalizeArabic, normalizeWords } from './normalize';
import { similarity } from './similarity';

export interface ExpectedWord {
  ayah: number;
  /** 1-based position of the word within its ayah. */
  position: number;
  text: string;
}

export type WordState = 'hidden' | 'correct' | 'missed' | 'hinted';

export type MatcherEvent =
  | { type: 'revealed'; index: number; state: 'correct' | 'hinted' }
  | { type: 'missed'; indices: number[] }
  | { type: 'ignored'; heard: string }
  | { type: 'wrong-ayah'; expectedAyah: number; heardAyah: number }
  | { type: 'hint'; index: number; level: 1 | 2; text: string }
  | { type: 'complete' };

export interface MatcherOptions {
  /** How many upcoming hidden words a heard word is compared with. */
  windowSize?: number;
  /** Minimum normalized similarity to accept a word. */
  threshold?: number;
  /** Time without progress before the first-letter hint; the whole word follows after twice this. */
  hintAfterMs?: number;
  /** Consecutive unmatched words that must match elsewhere to report the wrong ayah. */
  wrongAyahMinWords?: number;
  /**
   * How far past the window to look when recognition has dropped words: two consecutive heard
   * words matching there move the pointer (the words in between become missed).
   */
  resyncLookahead?: number;
  /**
   * Words searched when detecting the wrong ayah, for example the whole surah. Defaults to the
   * practised range itself.
   */
  context?: ExpectedWord[];
}

export interface MatcherSummary {
  wordsTotal: number;
  wordsCorrect: number;
  mistakes: { ayah: number; word: number; type: 'missed' | 'hinted' }[];
}

interface Target extends ExpectedWord {
  normalized: string;
  /** The same word with the dagger alef read as ا (مَـٰلِكِ → مالك). */
  spoken: string;
}

const toTarget = (w: ExpectedWord): Target => ({
  ...w,
  normalized: normalizeArabic(w.text),
  spoken: normalizeArabic(w.text, { daggerAlef: 'alef' }),
});

/**
 * Phrases people say before reciting. Their words resemble Quran words ("بالله" is one letter
 * from "الله"), so once an unmatched first word starts one, the rest of it is skipped.
 */
const OPENING_PHRASES = [
  ['اعوذ', 'بالله', 'من', 'الشيطان', 'الرجيم'],
  ['بسم', 'الله', 'الرحمن', 'الرحيم'],
];

export class RecitationMatcher {
  private readonly words: Target[];
  private readonly context: Target[];
  private readonly states: WordState[];
  private readonly windowSize: number;
  private readonly threshold: number;
  private readonly hintAfterMs: number;
  private readonly wrongAyahMinWords: number;
  private readonly resyncLookahead: number;
  private pointer = 0;
  private hintLevel: 0 | 1 | 2 = 0;
  private lastProgressAt: number;
  private unmatched: string[] = [];
  private lastUnmatched: string | null = null;
  private phrase: { words: string[]; next: number } | null = null;

  constructor(expected: ExpectedWord[], startedAt: number, options: MatcherOptions = {}) {
    if (expected.length === 0) throw new Error('Nothing to recite');
    this.words = expected.map(toTarget);
    this.context = options.context ? options.context.map(toTarget) : this.words;
    this.states = expected.map(() => 'hidden');
    this.windowSize = options.windowSize ?? 3;
    this.threshold = options.threshold ?? 0.8;
    this.hintAfterMs = options.hintAfterMs ?? 6000;
    this.wrongAyahMinWords = options.wrongAyahMinWords ?? 3;
    this.resyncLookahead = options.resyncLookahead ?? 10;
    this.lastProgressAt = startedAt;
  }

  get wordStates(): readonly WordState[] {
    return this.states;
  }

  /** Index of the next hidden word, or -1 when every word is revealed. */
  get nextIndex(): number {
    return this.isComplete ? -1 : this.pointer;
  }

  get isComplete(): boolean {
    return this.pointer >= this.words.length;
  }

  /** Feed newly heard words (raw recognizer output). */
  hear(heard: readonly string[], now: number): MatcherEvent[] {
    const events: MatcherEvent[] = [];
    for (const word of heard.flatMap((h) => normalizeWords(h))) {
      if (this.isComplete) break;
      if (this.continuesOpeningPhrase(word)) {
        events.push({ type: 'ignored', heard: word });
        continue;
      }
      const offset = this.matchInWindow(word);
      if (offset === -1) {
        const jump = this.findResync(word);
        if (jump !== -1) {
          // Recognition dropped words: resume after the two words just heard.
          const missed: number[] = [];
          for (let i = this.pointer; i < jump - 1; i++) missed.push(i);
          for (const i of missed) this.states[i] = 'missed';
          if (missed.length > 0) events.push({ type: 'missed', indices: missed });
          for (const index of [jump - 1, jump]) {
            this.states[index] = 'correct';
            events.push({ type: 'revealed', index, state: 'correct' });
          }
          this.advanceTo(jump + 1, now, events);
          continue;
        }
        this.startOpeningPhrase(word);
        events.push({ type: 'ignored', heard: word });
        const wrong = this.detectWrongAyah(word);
        if (wrong) events.push(wrong);
        continue;
      }
      if (offset > 0) {
        const missed = Array.from({ length: offset }, (_, i) => this.pointer + i);
        for (const i of missed) this.states[i] = 'missed';
        events.push({ type: 'missed', indices: missed });
      }
      const index = this.pointer + offset;
      const state = this.hintLevel > 0 ? 'hinted' : 'correct';
      this.states[index] = state;
      events.push({ type: 'revealed', index, state });
      this.advanceTo(index + 1, now, events);
    }
    return events;
  }

  private advanceTo(pointer: number, now: number, events: MatcherEvent[]): void {
    this.pointer = pointer;
    this.hintLevel = 0;
    this.lastProgressAt = now;
    this.unmatched = [];
    this.lastUnmatched = null;
    if (this.pointer >= this.words.length) events.push({ type: 'complete' });
  }

  /**
   * Index j past the window where the previous unmatched word matches word j-1 and `word` matches
   * word j, or -1. Two in a row are required so one misheard word never jumps ahead.
   */
  private findResync(word: string): number {
    const previous = this.lastUnmatched;
    this.lastUnmatched = word;
    if (previous === null) return -1;
    const start = this.pointer + this.windowSize;
    const end = Math.min(this.pointer + this.windowSize + this.resyncLookahead, this.words.length);
    const currentAyah = this.words[this.pointer]?.ayah ?? 0;
    for (let j = Math.max(start, this.pointer + 1); j < end; j++) {
      const before = this.words[j - 1];
      const target = this.words[j];
      // Dropped words stay within this ayah or run into the next; a further jump is the wrong
      // ayah, which is reported instead.
      if (!before || !target || before.ayah > currentAyah + 1) break;
      if (this.matches(previous, before) && this.matches(word, target)) return j;
    }
    return -1;
  }

  /** Call periodically; emits a hint after a pause without progress. */
  tick(now: number): MatcherEvent[] {
    const target = this.words[this.pointer];
    if (!target) return [];
    const idle = now - this.lastProgressAt;
    if (this.hintLevel === 0 && idle >= this.hintAfterMs) {
      this.hintLevel = 1;
      return [{ type: 'hint', index: this.pointer, level: 1, text: firstLetter(target.text) }];
    }
    if (this.hintLevel === 1 && idle >= this.hintAfterMs * 2) {
      this.hintLevel = 2;
      return [{ type: 'hint', index: this.pointer, level: 2, text: target.text }];
    }
    return [];
  }

  /**
   * The user is still speaking or the recognizer is still working: postpones hints, which are
   * for a pause without progress, not for recognition latency.
   */
  touch(now: number): void {
    this.lastProgressAt = Math.max(this.lastProgressAt, now);
  }

  summary(): MatcherSummary {
    const mistakes: MatcherSummary['mistakes'] = [];
    this.states.forEach((state, i) => {
      const w = this.words[i];
      if (w && (state === 'missed' || state === 'hinted')) {
        mistakes.push({ ayah: w.ayah, word: w.position, type: state });
      }
    });
    return {
      wordsTotal: this.words.length,
      wordsCorrect: this.states.filter((s) => s === 'correct').length,
      mistakes,
    };
  }

  private similar(a: string, b: string): boolean {
    return similarity(a, b) >= this.threshold;
  }

  private matches(word: string, target: Target): boolean {
    return this.similar(word, target.normalized) || this.similar(word, target.spoken);
  }

  private continuesOpeningPhrase(word: string): boolean {
    const phrase = this.phrase;
    if (!phrase) return false;
    const expected = phrase.words[phrase.next];
    if (expected !== undefined && this.similar(word, expected)) {
      phrase.next += 1;
      if (phrase.next >= phrase.words.length) this.phrase = null;
      return true;
    }
    this.phrase = null;
    return false;
  }

  private startOpeningPhrase(word: string): void {
    const words = OPENING_PHRASES.find((p) => this.similar(word, p[0] ?? ''));
    this.phrase = words ? { words, next: 1 } : null;
  }

  /** Offset of the earliest window word similar enough to `word`, or -1. */
  private matchInWindow(word: string): number {
    const end = Math.min(this.pointer + this.windowSize, this.words.length);
    for (let i = this.pointer; i < end; i++) {
      const target = this.words[i];
      if (target && this.matches(word, target)) return i - this.pointer;
    }
    return -1;
  }

  private detectWrongAyah(word: string): MatcherEvent | null {
    this.unmatched.push(word);
    const n = this.wrongAyahMinWords;
    if (this.unmatched.length < n) return null;
    const recent = this.unmatched.slice(-n);
    const expectedAyah = this.words[this.pointer]?.ayah;
    if (expectedAyah === undefined) return null;

    for (let start = 0; start + n <= this.context.length; start++) {
      const run = this.context.slice(start, start + n);
      const matches = run.every((t, k) => this.matches(recent[k] ?? '', t));
      const heardAyah = run[0]?.ayah;
      if (matches && heardAyah !== undefined && heardAyah !== expectedAyah) {
        this.unmatched = [];
        return { type: 'wrong-ayah', expectedAyah, heardAyah };
      }
    }
    return null;
  }
}

/** First letter with its marks, so the hint looks like the mushaf text. */
function firstLetter(text: string): string {
  const match = /^\P{M}\p{M}*/u.exec(text.normalize('NFC'));
  return match?.[0] ?? text.slice(0, 1);
}

/** Builds the expected words for a range from quran-data's ayah structure. */
export function expectedWordsFrom(
  ayahs: readonly { number: number; words: readonly { position: number; text: string }[] }[],
): ExpectedWord[] {
  return ayahs.flatMap((a) =>
    a.words.map((w) => ({ ayah: a.number, position: w.position, text: w.text })),
  );
}
