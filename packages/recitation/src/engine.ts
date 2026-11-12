// The speech engine contract. The web (transformers.js in a Web Worker) and the future mobile app
// (whisper.rn) implement it; the matcher and practice screen only ever see this interface.

export interface RecognitionEngine {
  load(onProgress?: (pct: number) => void): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  /** Words heard so far in the current chunk. */
  onPartial(cb: (words: string[]) => void): void;
  onError(cb: (e: Error) => void): void;
  /** True while speech is being heard or recognised (results may still arrive). */
  isBusy?(): boolean;
}

export interface FakeEngineOptions {
  /** Words to "hear", in order. */
  script: string[];
  /** Delay between words, ms. */
  intervalMs?: number;
  /** Words per partial result (to imitate chunked recognition). */
  wordsPerPartial?: number;
}

/** Emits scripted words on a timer. Used by unit tests, component tests and Playwright. */
export class FakeEngine implements RecognitionEngine {
  private partial: ((words: string[]) => void) | null = null;
  private error: ((e: Error) => void) | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private index = 0;
  loaded = false;
  running = false;

  constructor(private readonly options: FakeEngineOptions) {}

  load(onProgress?: (pct: number) => void): Promise<void> {
    onProgress?.(100);
    this.loaded = true;
    return Promise.resolve();
  }

  start(): Promise<void> {
    if (!this.loaded) return Promise.reject(new Error('FakeEngine: call load() first'));
    this.running = true;
    if (this.index >= this.options.script.length) this.index = 0; // a finished script starts over
    const per = this.options.wordsPerPartial ?? 1;
    this.timer = setInterval(() => {
      const words = this.options.script.slice(this.index, this.index + per);
      this.index += per;
      if (words.length > 0) this.partial?.(words);
      if (this.index >= this.options.script.length) void this.stop();
    }, this.options.intervalMs ?? 300);
    return Promise.resolve();
  }

  stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.running = false;
    return Promise.resolve();
  }

  onPartial(cb: (words: string[]) => void): void {
    this.partial = cb;
  }

  onError(cb: (e: Error) => void): void {
    this.error = cb;
  }

  /** Test helper: simulate an engine failure. */
  fail(message: string): void {
    this.error?.(new Error(message));
  }
}
