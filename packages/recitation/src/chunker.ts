// Turns a stream of 16 kHz mono samples into speech segments for the recognizer. Segments end at
// natural pauses (reciters pause between phrases), so words are rarely cut in half; continuous
// speech is cut at a maximum length with an overlap. Silence is never sent. Pure: no Web Audio.

export interface ChunkerOptions {
  sampleRate?: number;
  /** A pause at least this long ends a segment. */
  pauseSec?: number;
  /** Segments shorter than this wait for more speech, unless the pause gets long. */
  minSec?: number;
  /** Continuous speech is cut at this length (keeps latency bounded). */
  maxSec?: number;
  /** Audio carried into the next segment after a cut at maxSec, so boundary words survive. */
  overlapSec?: number;
  /** Silence kept before speech starts, so the first sound is not clipped. */
  preRollSec?: number;
  /** Frame RMS below this is treated as silence. */
  silenceRms?: number;
}

export interface ChunkInfo {
  /** True when the segment starts with audio from the previous one (a cut at maxSec). */
  overlapped: boolean;
}

export function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const s of samples) sum += s * s;
  return Math.sqrt(sum / samples.length);
}

export class AudioChunker {
  readonly sampleRate: number;
  private readonly frameSize: number;
  private readonly pauseFrames: number;
  private readonly minSize: number;
  private readonly maxSize: number;
  private readonly overlapSize: number;
  private readonly preRollSize: number;
  private readonly silenceRms: number;
  private readonly buffer: Float32Array;
  private filled = 0;
  private readonly frame: Float32Array;
  private frameFilled = 0;
  private voicedFrames = 0;
  private silentFrames = 0;
  private overlapped = false;

  constructor(
    private readonly onChunk: (chunk: Float32Array, info: ChunkInfo) => void,
    options: ChunkerOptions = {},
  ) {
    const sr = (this.sampleRate = options.sampleRate ?? 16_000);
    this.frameSize = Math.round(0.05 * sr); // 50 ms frames for voice detection
    this.pauseFrames = Math.max(1, Math.round((options.pauseSec ?? 0.35) / 0.05));
    this.minSize = Math.round((options.minSec ?? 0.8) * sr);
    this.maxSize = Math.round((options.maxSec ?? 5) * sr);
    this.overlapSize = Math.round((options.overlapSec ?? 0.8) * sr);
    this.preRollSize = Math.round((options.preRollSec ?? 0.25) * sr);
    this.silenceRms = options.silenceRms ?? 0.01;
    this.buffer = new Float32Array(this.maxSize);
    this.frame = new Float32Array(this.frameSize);
  }

  /** True while speech has been heard that has not been sent yet. */
  get speaking(): boolean {
    return this.voicedFrames > 0;
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
  }

  /** Sends what is left (e.g. when the user stops), if it contains speech. */
  flush(): void {
    if (this.frameFilled > 0) {
      this.append(this.frame.subarray(0, this.frameFilled));
      if (rms(this.frame.subarray(0, this.frameFilled)) >= this.silenceRms) this.voicedFrames += 1;
      this.frameFilled = 0;
    }
    if (this.voicedFrames > 0) this.emit(this.filled);
    this.reset();
  }

  private onFrame(frame: Float32Array): void {
    const voiced = rms(frame) >= this.silenceRms;
    if (!voiced && this.voicedFrames === 0) {
      // No speech yet: keep only a short pre-roll of silence.
      this.append(frame);
      if (this.filled > this.preRollSize) this.dropFront(this.filled - this.preRollSize);
      return;
    }
    this.append(frame);
    if (voiced) {
      this.voicedFrames += 1;
      this.silentFrames = 0;
    } else this.silentFrames += 1;

    const paused = this.silentFrames >= this.pauseFrames;
    const longPause = this.silentFrames >= this.pauseFrames * 3;
    if (paused && (this.filled >= this.minSize || longPause)) {
      this.emit(this.filled);
      this.reset();
    } else if (this.filled + this.frameSize > this.maxSize) {
      this.emit(this.filled);
      this.dropFront(this.filled - this.overlapSize);
      this.overlapped = true;
      this.voicedFrames = 1;
      this.silentFrames = 0;
    }
  }

  private emit(length: number): void {
    this.onChunk(this.buffer.slice(0, length), { overlapped: this.overlapped });
  }

  private reset(): void {
    this.filled = 0;
    this.voicedFrames = 0;
    this.silentFrames = 0;
    this.overlapped = false;
  }

  private append(samples: Float32Array): void {
    this.buffer.set(samples, this.filled);
    this.filled += samples.length;
  }

  private dropFront(count: number): void {
    this.buffer.copyWithin(0, count, this.filled);
    this.filled -= count;
  }
}
