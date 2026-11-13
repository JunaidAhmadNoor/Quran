import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeEngine, rms } from '../src';

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

describe('rms', () => {
  it('measures loudness', () => {
    expect(rms(new Float32Array([0, 0]))).toBe(0);
    expect(rms(new Float32Array([1, -1]))).toBe(1);
    expect(rms(new Float32Array())).toBe(0);
  });
});
