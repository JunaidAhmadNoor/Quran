import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioChunker, FakeEngine, dropOverlap, freshWords, rms } from '../src';

afterEach(() => vi.useRealTimers());

describe('FakeEngine', () => {
  it('emits scripted words on a timer after load, then stops', async () => {
    vi.useFakeTimers();
    const engine = new FakeEngine({
      script: ['قل', 'هو', 'الله'],
      intervalMs: 100,
      wordsPerPartial: 2,
    });
    const heard: string[][] = [];
    engine.onPartial((w) => heard.push(w));
    await expect(engine.start()).rejects.toThrow(/load/);
    const progress = vi.fn();
    await engine.load(progress);
    expect(progress).toHaveBeenCalledWith(100);
    await engine.start();
    vi.advanceTimersByTime(250);
    expect(heard).toEqual([['قل', 'هو'], ['الله']]);
    expect(engine.running).toBe(false);
  });

  it('reports failures through onError', () => {
    const engine = new FakeEngine({ script: [] });
    const onError = vi.fn();
    engine.onError(onError);
    engine.fail('mic lost');
    expect(onError).toHaveBeenCalledWith(new Error('mic lost'));
  });
});

const tone = (seconds: number, amplitude: number, rate = 16_000) =>
  Float32Array.from(
    { length: Math.round(seconds * rate) },
    (_, i) => amplitude * Math.sin((2 * Math.PI * 220 * i) / rate),
  );

describe('AudioChunker', () => {
  const SR = 16_000;
  const collect = (options = {}) => {
    const chunks: { audio: Float32Array; overlapped: boolean }[] = [];
    const chunker = new AudioChunker((audio, info) => chunks.push({ audio, ...info }), options);
    return { chunks, chunker };
  };
  const silence = (sec: number) => new Float32Array(Math.round(sec * SR));
  const concat = (...parts: Float32Array[]) => {
    const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0;
    for (const p of parts) {
      out.set(p, o);
      o += p.length;
    }
    return out;
  };

  it('ends a segment at a pause, keeping a short pre-roll before the speech', () => {
    const { chunks, chunker } = collect();
    chunker.push(concat(silence(2), tone(1.2, 0.3), silence(0.5)));
    expect(chunks).toHaveLength(1);
    // 0.25 s pre-roll + 1.2 s speech + 0.35 s pause
    expect(chunks[0]?.audio.length).toBe(Math.round(1.8 * SR));
    expect(chunks[0]?.overlapped).toBe(false);
  });

  it('splits phrases separated by pauses into separate segments', () => {
    const { chunks, chunker } = collect();
    chunker.push(concat(tone(1, 0.3), silence(0.6), tone(1.5, 0.3), silence(0.6)));
    expect(chunks.map((c) => c.overlapped)).toEqual([false, false]);
  });

  it('waits for more speech after a very short word, unless the pause gets long', () => {
    const { chunks, chunker } = collect();
    chunker.push(concat(tone(0.3, 0.3), silence(0.4)));
    expect(chunks).toHaveLength(0); // shorter than minSec: maybe more is coming
    chunker.push(silence(1));
    expect(chunks).toHaveLength(1);
  });

  it('cuts continuous speech at the maximum length, overlapping the next segment', () => {
    const { chunks, chunker } = collect({ maxSec: 5, overlapSec: 0.8 });
    const audio = tone(8, 0.3);
    chunker.push(audio);
    chunker.flush();
    expect(chunks).toHaveLength(2);
    const first = chunks[0]?.audio ?? new Float32Array();
    expect(first.length).toBeLessThanOrEqual(5 * SR);
    expect(chunks[1]?.overlapped).toBe(true);
    // The second segment starts with the last 0.8 s of the first.
    expect(Array.from(chunks[1]?.audio.subarray(0, 0.8 * SR) ?? [])).toEqual(
      Array.from(first.subarray(first.length - 0.8 * SR)),
    );
  });

  it('accepts audio in small pieces, as an AudioWorklet delivers it', () => {
    const { chunks, chunker } = collect();
    const audio = concat(tone(1.2, 0.3), silence(0.5));
    for (let i = 0; i < audio.length; i += 128) chunker.push(audio.subarray(i, i + 128));
    expect(chunks).toHaveLength(1);
  });

  it('never sends silence to the model', () => {
    const { chunks, chunker } = collect();
    chunker.push(tone(5, 0.001));
    chunker.flush();
    expect(chunks).toHaveLength(0);
    expect(chunker.speaking).toBe(false);
  });

  it('reports speech that has not been sent yet, and flushes it on stop', () => {
    const { chunks, chunker } = collect();
    chunker.push(tone(1.2, 0.3));
    expect(chunker.speaking).toBe(true);
    chunker.flush();
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.audio.length).toBe(Math.round(1.2 * SR));
    expect(chunker.speaking).toBe(false);
  });

  it('computes RMS', () => {
    expect(rms(new Float32Array([0, 0]))).toBe(0);
    expect(rms(new Float32Array([1, -1]))).toBe(1);
    expect(rms(new Float32Array())).toBe(0);
  });
});

describe('dropOverlap', () => {
  it.each([
    [['قل', 'هو', 'الله'], ['الله', 'احد'], ['احد']],
    [['قل', 'هو', 'الله'], ['هو', 'الله', 'احد'], ['احد']],
    [
      ['قل', 'هو'],
      ['الله', 'احد'],
      ['الله', 'احد'],
    ],
    [[], ['قل'], ['قل']],
    [['ٱللَّهُ'], ['الله', 'الصمد'], ['الصمد']], // compares normalized text
  ])('%j then %j → %j', (previous, next, expected) => {
    expect(dropOverlap(previous, next)).toEqual(expected);
  });
});

describe('freshWords', () => {
  const previous = ['وما', 'ادراك', 'ما', 'ليلة', 'القدر'];

  it('drops a short echo of the last word (it would match the next ayah too early)', () => {
    // Heard in a real run: the reverb after "ليلة القدر" came back as "والقدر".
    expect(freshWords(previous, ['والقدر'], { overlapped: false, durationSec: 0.9 })).toEqual([]);
    expect(freshWords(previous, ['القدر'], { overlapped: false, durationSec: 0.9 })).toEqual([]);
    // A short segment with new words keeps them, even when it starts like the previous end.
    expect(freshWords(previous, ['خير'], { overlapped: false, durationSec: 0.9 })).toEqual(['خير']);
    expect(freshWords(previous, ['القدر', 'خير'], { overlapped: false, durationSec: 1.2 })).toEqual(
      ['القدر', 'خير'],
    );
  });

  it('removes the repeated start of a segment cut mid-speech', () => {
    expect(
      freshWords(previous, ['ليلة', 'القدر', 'خير'], { overlapped: true, durationSec: 5 }),
    ).toEqual(['خير']);
  });

  it('keeps a deliberate repetition after a pause', () => {
    expect(
      freshWords(previous, ['ليلة', 'القدر', 'خير'], { overlapped: false, durationSec: 3 }),
    ).toEqual(['ليلة', 'القدر', 'خير']);
  });
});
