import { describe, expect, it } from 'vitest';
import {
  StreamingTranscriber,
  agreedPrefix,
  alignAfter,
  repeatedLead,
  type TranscriptionJob,
} from '../src';

const SR = 16_000;
const tone = (sec: number, amp = 0.3) =>
  Float32Array.from(
    { length: Math.round(sec * SR) },
    (_, i) => amp * Math.sin((i / SR) * 2 * Math.PI * 220),
  );
const silence = (sec: number) => new Float32Array(Math.round(sec * SR));

function setup(options = {}) {
  const jobs: TranscriptionJob[] = [];
  const heard: string[][] = [];
  const s = new StreamingTranscriber(
    (j) => jobs.push(j),
    (w) => heard.push(w),
    options,
  );
  const last = (): TranscriptionJob => {
    const job = jobs.at(-1);
    if (!job) throw new Error('No job was sent');
    return job;
  };
  return { s, jobs, heard, last };
}

describe('agreement helpers', () => {
  it('counts the leading words two transcriptions agree on (spelling variants allowed)', () => {
    expect(agreedPrefix(['قل', 'هو', 'الله'], ['قُلْ', 'هو', 'اللة', 'احد'])).toBe(3);
    expect(agreedPrefix(['قل', 'هو'], ['قل', 'هي'])).toBe(1);
    expect(agreedPrefix([], ['قل'])).toBe(0);
  });

  it('finds where the committed words end in a new transcription, by content', () => {
    const committed = ['الحمد', 'لله'];
    expect(alignAfter(committed, ['الحمد', 'لله', 'رب'])).toBe(2);
    // Whisper dropped the first word this time: the new words still start after "لله".
    expect(alignAfter(committed, ['لله', 'رب', 'العالمين'])).toBe(1);
    // An extra word appeared at the start.
    expect(alignAfter(committed, ['بسم', 'الحمد', 'لله', 'رب'])).toBe(3);
    // None of the committed words near the start: Whisper left that audio out, all of it is new.
    expect(alignAfter(committed, ['ا', 'ب', 'ج'])).toBe(0);
    // Seen in a real run (Al-Fatiha): the basmala was dropped and "الرحمن الرحيم" recurs in ayah 3.
    expect(
      alignAfter(
        ['بسم', 'الله', 'الرحمن', 'الرحيم'],
        ['الحمد', 'لله', 'رب', 'العالمين', 'الرحمن', 'الرحيم'],
      ),
    ).toBe(0);
    expect(alignAfter([], ['قل'])).toBe(0);
  });

  it('finds words repeated from kept audio, even when the first one is clipped', () => {
    const committed = ['لا', 'تأخذه', 'سنة', 'ولا', 'نوم'];
    expect(repeatedLead(committed, ['ولا', 'نوم', 'له', 'ما'])).toBe(2);
    expect(repeatedLead(committed, ['خذه', 'سنة', 'ولا', 'نوم', 'له'])).toBe(4);
    expect(repeatedLead(committed, ['له', 'ما', 'في'])).toBe(0);
  });
});

describe('StreamingTranscriber (LocalAgreement)', () => {
  it('re-transcribes the growing buffer and reveals words two passes agree on', () => {
    const { s, jobs, heard, last } = setup();
    s.push(tone(0.7));
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.final).toBe(false);
    s.push(tone(1)); // a pass is running: no second job yet
    expect(jobs).toHaveLength(1);
    s.result(0, 'قل هو');
    expect(heard).toEqual([]); // nothing to agree with yet
    expect(jobs).toHaveLength(2); // the buffer grew meanwhile
    expect(last().audio.length).toBeGreaterThan(jobs[0]?.audio.length ?? 0); // whole buffer again
    s.result(1, 'قل هو الله');
    expect(heard).toEqual([['قل', 'هو']]);
    s.push(tone(0.7));
    s.result(2, 'قل هو الله احد');
    expect(heard).toEqual([['قل', 'هو'], ['الله']]);
  });

  it('a pause finishes the phrase: everything in it is revealed and a new phrase starts', () => {
    const { s, heard, last } = setup();
    s.push(tone(0.7));
    s.result(0, 'قل هو');
    s.push(silence(0.6));
    expect(last().final).toBe(true);
    s.result(1, 'قل هو الله احد');
    expect(heard.flat()).toEqual(['قل', 'هو', 'الله', 'احد']);
    expect(s.busy).toBe(false);
    s.push(tone(0.7));
    expect(last().final).toBe(false);
    expect(last().audio.length).toBeLessThan(1.5 * SR); // only the new phrase
    s.result(2, 'الله');
    s.push(tone(0.7));
    s.result(3, 'الله الصمد');
    expect(heard.flat()).toEqual(['قل', 'هو', 'الله', 'احد', 'الله']);
  });

  it('continuous speech is cut at the maximum length, keeping audio so the boundary word survives', () => {
    const { s, heard, last } = setup({ maxBufferSec: 4, keepSec: 1, stepSec: 10 });
    s.push(tone(4.1));
    expect(last().final).toBe(true);
    s.result(last().id, 'الله لا اله الا هو الحي');
    expect(heard.flat()).toEqual(['الله', 'لا', 'اله', 'الا', 'هو', 'الحي']);
    // The kept second is heard again at the start of the next phrase: not revealed twice.
    s.push(silence(0.6));
    const next = last();
    expect(next.final).toBe(true);
    expect(next.audio.length).toBeLessThan(2 * SR);
    s.result(next.id, 'هو الحي القيوم');
    expect(heard.flat()).toEqual(['الله', 'لا', 'اله', 'الا', 'هو', 'الحي', 'القيوم']);
  });

  it('keeps speech that arrives while the final pass of the previous phrase runs', () => {
    const { s, heard, last } = setup();
    s.push(tone(0.7));
    s.result(0, 'قل');
    s.push(silence(0.6)); // final pass sent
    const finalId = last().id;
    s.push(tone(0.8)); // the user carries on meanwhile
    s.result(finalId, 'قل هو الله احد');
    expect(last().final).toBe(false); // the new phrase is already being transcribed
    expect(last().audio.length).toBeGreaterThan(0.6 * SR);
    expect(heard.flat()).toEqual(['قل', 'هو', 'الله', 'احد']);
  });

  it('never sends silence, and reports when it is busy', () => {
    const { s, jobs } = setup();
    s.push(silence(3));
    expect(jobs).toHaveLength(0);
    expect(s.busy).toBe(false);
    s.push(tone(0.3));
    expect(s.busy).toBe(true);
  });

  it('ignores stale results and recovers from a failed pass', () => {
    const { s, jobs, heard } = setup();
    s.push(tone(0.7));
    s.result(99, 'قل'); // unknown job
    expect(heard).toEqual([]);
    s.failed(0);
    s.push(tone(0.7));
    expect(jobs).toHaveLength(2);
  });

  it('does not lose words when the final pass transcribes the start differently', () => {
    const { s, heard, last } = setup();
    s.push(tone(0.7));
    s.result(0, 'الحمد لله');
    s.push(tone(0.7));
    s.result(1, 'الحمد لله رب');
    expect(heard.flat()).toEqual(['الحمد', 'لله']);
    s.push(silence(0.6));
    s.result(last().id, 'لله رب العالمين'); // first word dropped in the final pass
    expect(heard.flat()).toEqual(['الحمد', 'لله', 'رب', 'العالمين']);
  });

  it('flush on stop commits what was said', () => {
    const { s, heard, last } = setup();
    s.push(tone(0.7));
    s.result(0, 'قل هو');
    s.flush();
    expect(last().final).toBe(true);
    s.result(last().id, 'قل هو الله');
    expect(heard.flat()).toEqual(['قل', 'هو', 'الله']);
  });
});
