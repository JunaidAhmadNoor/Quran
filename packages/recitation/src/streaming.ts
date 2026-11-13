// Streaming recognition for continuous recitation, without cutting words: the "LocalAgreement"
// policy of whisper_streaming (Macháček, Dabre & Bojar, 2023). One audio buffer grows while the
// user recites and is transcribed again and again; a word is confirmed once two consecutive
// transcriptions agree on it. The buffer starts again at a pause (or at a safe maximum length),
// so Whisper always hears whole phrases, which is how the Quran models were trained (whole
// ayahs). Pure: the caller runs the model and feeds results back.
import { normalizeArabic } from './normalize';
import { similarity } from './similarity';

export interface StreamingOptions {
  sampleRate?: number;
  /** Frame RMS below this is treated as silence. */
  silenceRms?: number;
  /** Silence after speech that ends the phrase: the buffer is transcribed once more and reset. */
  pauseSec?: number;
  /** New audio needed before the next interim transcription. */
  stepSec?: number;
  /** The buffer is finalized at this length even without a pause (Whisper's window is 30 s). */
  maxBufferSec?: number;
  /** After a forced cut, this much audio is kept so the word on the boundary survives. */
  keepSec?: number;
  /** Silence kept before speech starts, so the first sound is not clipped. */
  preRollSec?: number;
}

export interface TranscriptionJob {
  id: number;
  audio: Float32Array;
  /** Final pass of a phrase: every word in it is committed. */
  final: boolean;
}

const FRAME_SEC = 0.05;

/** Root mean square loudness of a frame (0 for silence). */
export function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const s of samples) sum += s * s;
  return Math.sqrt(sum / samples.length);
}

const same = (a: string, b: string) => {
  const x = normalizeArabic(a);
  const y = normalizeArabic(b);
  return x !== '' && (x === y || similarity(x, y) >= 0.85);
};

/** Number of leading words two transcriptions agree on. */
export function agreedPrefix(a: readonly string[], b: readonly string[]): number {
  let n = 0;
  while (n < a.length && n < b.length && same(a[n] ?? '', b[n] ?? '')) n++;
  return n;
}

/**
 * Where the already-committed words end inside a new transcription of the same buffer. The
 * committed words are aligned in order from the start, each looked for a few words ahead, so a
 * word Whisper dropped or added at the start does not shift what is new. When none of them is
 * found near the start, Whisper left that audio out this time and everything is new: matching the
 * committed tail further on would skip words when a phrase repeats (الرحمن الرحيم in Al-Fatiha).
 */
export function alignAfter(committed: readonly string[], words: readonly string[]): number {
  const LOOKAHEAD = 3;
  let j = 0;
  for (const word of committed) {
    for (let k = j; k < Math.min(j + LOOKAHEAD, words.length); k++) {
      if (same(word, words[k] ?? '')) {
        j = k + 1;
        break;
      }
    }
  }
  return j;
}

/**
 * Words at the start of `words` that repeat the end of `committed` (audio kept after a forced cut
 * is heard again). The first word may be clipped, so it is allowed to differ.
 */
export function repeatedLead(committed: readonly string[], words: readonly string[]): number {
  for (let k = Math.min(8, committed.length, words.length); k > 0; k--) {
    const tail = committed.slice(committed.length - k);
    if (tail.every((w, i) => same(w, words[i] ?? ''))) return k;
    if (words.length > k && tail.every((w, i) => same(w, words[i + 1] ?? ''))) return k + 1;
  }
  return 0;
}

export class StreamingTranscriber {
  private readonly sr: number;
  private readonly frameSize: number;
  private readonly silenceRms: number;
  private readonly pauseFrames: number;
  private readonly stepSize: number;
  private readonly maxSize: number;
  private readonly keepSize: number;
  private readonly preRollSize: number;
  private buffer: Float32Array;
  private filled = 0;
  private readonly frame: Float32Array;
  private frameFilled = 0;
  private speech = false;
  private silentFrames = 0;
  private sentAt = 0;
  private nextId = 0;
  private pending: { id: number; final: boolean; length: number; forced: boolean } | null = null;
  /** The previous interim transcription of the current buffer. */
  private previous: string[] = [];
  /** Words of the current buffer already emitted. */
  private committedWords: string[] = [];
  /** Recently emitted words, to drop what kept audio repeats after a forced cut. */
  private history: string[] = [];
  private carried = false;

  constructor(
    private readonly send: (job: TranscriptionJob) => void,
    private readonly emit: (words: string[]) => void,
    options: StreamingOptions = {},
  ) {
    this.sr = options.sampleRate ?? 16_000;
    this.frameSize = Math.round(FRAME_SEC * this.sr);
    this.silenceRms = options.silenceRms ?? 0.01;
    this.pauseFrames = Math.max(1, Math.round((options.pauseSec ?? 0.5) / FRAME_SEC));
    this.stepSize = Math.round((options.stepSec ?? 0.6) * this.sr);
    this.maxSize = Math.round((options.maxBufferSec ?? 24) * this.sr);
    this.keepSize = Math.round((options.keepSec ?? 3) * this.sr);
    this.preRollSize = Math.round((options.preRollSec ?? 0.25) * this.sr);
    this.buffer = new Float32Array(this.maxSize + this.sr * 8); // room while a pass is running
    this.frame = new Float32Array(this.frameSize);
  }

  /** True while speech is buffered or a transcription is running (results may still arrive). */
  get busy(): boolean {
    return this.pending !== null || this.speech;
  }

  push(samples: Float32Array): void {
    let offset = 0;
    while (offset < samples.length) {
      const take = Math.min(this.frameSize - this.frameFilled, samples.length - offset);
      this.frame.set(samples.subarray(offset, offset + take), this.frameFilled);
      this.frameFilled += take;
      offset += take;
      if (this.frameFilled === this.frameSize) {
        this.onFrame(this.frame);
        this.frameFilled = 0;
      }
    }
    this.schedule();
  }

  /** The recognizer's text for a job. */
  result(id: number, text: string): void {
    const job = this.pending;
    if (job?.id !== id) return;
    this.pending = null;
    let words = text.trim().split(/\s+/).filter(Boolean);
    if (this.carried) words = words.slice(repeatedLead(this.history, words));

    const start = alignAfter(this.committedWords, words);
    if (job.final) {
      this.commit(words.slice(start));
      this.restart(job.length, job.forced);
    } else {
      const agreed = agreedPrefix(this.previous, words);
      if (agreed > start) this.commit(words.slice(start, agreed));
      this.previous = words;
    }
    this.schedule();
  }

  /** A failed job: drop it and carry on. */
  failed(id: number): void {
    if (this.pending?.id === id) this.pending = null;
    this.schedule();
  }

  /** Stopping: transcribe what is left once more, committing everything. */
  flush(): void {
    if (this.frameFilled > 0) {
      this.append(this.frame.subarray(0, this.frameFilled));
      this.frameFilled = 0;
    }
    this.silentFrames = this.pauseFrames; // treat as the end of the phrase
    this.schedule();
  }

  private onFrame(frame: Float32Array): void {
    const voiced = rms(frame) >= this.silenceRms;
    this.append(frame);
    if (voiced) {
      this.speech = true;
      this.silentFrames = 0;
    } else if (this.speech) {
      this.silentFrames += 1;
    } else if (this.filled > this.preRollSize && this.pending === null) {
      // No speech yet: keep only a short pre-roll.
      this.drop(this.filled - this.preRollSize);
    }
  }

  private schedule(): void {
    if (this.pending || !this.speech || this.filled === 0) return;
    const paused = this.silentFrames >= this.pauseFrames;
    const full = this.filled >= this.maxSize;
    if (paused || full) this.dispatch(true, full && !paused);
    else if (this.filled - this.sentAt >= this.stepSize) this.dispatch(false, false);
  }

  private dispatch(final: boolean, forced: boolean): void {
    const id = this.nextId++;
    this.pending = { id, final, length: this.filled, forced };
    this.sentAt = this.filled;
    this.send({ id, audio: this.buffer.slice(0, this.filled), final });
  }

  private commit(fresh: string[]): void {
    if (fresh.length === 0) return;
    this.committedWords = [...this.committedWords, ...fresh];
    this.history = [...this.history, ...fresh].slice(-16);
    this.emit(fresh);
  }

  /** Starts a new phrase with the audio that arrived during the final pass (and the kept tail). */
  private restart(finalLength: number, forced: boolean): void {
    const keep = forced ? Math.min(this.keepSize, finalLength) : 0;
    this.drop(finalLength - keep);
    this.carried = forced;
    this.previous = [];
    this.committedWords = [];
    this.sentAt = 0;
    // Is there speech in what remains (the user carried on during the final pass)?
    let voiced = false;
    for (let i = 0; i + this.frameSize <= this.filled; i += this.frameSize) {
      if (rms(this.buffer.subarray(i, i + this.frameSize)) >= this.silenceRms) voiced = true;
    }
    this.speech = voiced || forced;
    this.silentFrames = 0;
    if (!voiced && !forced && this.filled > this.preRollSize)
      this.drop(this.filled - this.preRollSize);
  }

  private append(samples: Float32Array): void {
    if (this.filled + samples.length > this.buffer.length) {
      // A pass is running and audio keeps coming: drop the oldest audio rather than overflow.
      this.drop(this.filled + samples.length - this.buffer.length);
    }
    this.buffer.set(samples, this.filled);
    this.filled += samples.length;
  }

  private drop(count: number): void {
    if (count <= 0) return;
    this.buffer.copyWithin(0, count, this.filled);
    this.filled -= count;
    this.sentAt = Math.max(0, this.sentAt - count);
    if (this.pending) this.pending.length = Math.max(0, this.pending.length - count);
  }
}
