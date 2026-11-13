'use client';
// RecognitionEngine for the browser: microphone → AudioWorklet (16 kHz) → streaming transcriber
// (one growing buffer per phrase, words confirmed when two passes agree) → Whisper in a Web
// Worker → words. Nothing is uploaded or stored.
import {
  StreamingTranscriber,
  type RecognitionEngine,
  type TranscriptionJob,
} from '@tilawah/recitation';
import {
  BASE_MODEL,
  TINY_MODEL,
  detectDevice,
  encoderFile,
  modelBaseUrl,
  pickModel,
  type SpeechDevice,
  type SpeechModel,
} from './models';
import type { WorkerRequest, WorkerResponse } from './whisper.worker';

export class WebSpeechEngine implements RecognitionEngine {
  private worker: Worker | null = null;
  private partial: (words: string[]) => void = () => undefined;
  private error: (e: Error) => void = () => undefined;
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private transcriber: StreamingTranscriber | null = null;
  private sentAt = 0;
  private failures = 0;
  model: SpeechModel = pickModel();
  /** The device in use once loaded (null before). */
  device: SpeechDevice | null = null;
  private planned: SpeechDevice | null = null;
  /** Whether WebAssembly can use several threads (see next.config.ts). */
  isolated = false;

  private loading: Promise<void> | null = null;

  /** Chooses the device and so the files to download: their size, and a file to check the cache. */
  async plan(): Promise<{ sizeMb: number; probeUrl: string }> {
    this.planned ??= await detectDevice();
    return {
      sizeMb: this.model.sizeMb[this.planned],
      probeUrl: `${modelBaseUrl()}/${this.model.id}/${encoderFile(this.planned)}`,
    };
  }

  /** Loads once; later calls share the same promise (a failed load can be retried). */
  load(onProgress?: (pct: number) => void): Promise<void> {
    this.loading ??= this.loadOnce(onProgress).catch((error: unknown) => {
      this.loading = null;
      this.worker?.terminate();
      this.worker = null;
      throw error;
    });
    return this.loading;
  }

  private async loadOnce(onProgress?: (pct: number) => void): Promise<void> {
    await this.plan();
    try {
      await this.loadModel(this.model, onProgress);
    } catch (error) {
      if (this.model.id === TINY_MODEL.id) throw error;
      // The base model can run out of memory on small devices: try the tiny one.
      this.worker?.terminate();
      this.model = TINY_MODEL;
      await this.loadModel(TINY_MODEL, onProgress);
    }
  }

  private loadModel(model: SpeechModel, onProgress?: (pct: number) => void): Promise<void> {
    const worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' });
    this.worker = worker;
    return new Promise((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const m = event.data;
        if (m.type === 'progress') onProgress?.(m.pct);
        else if (m.type === 'ready') {
          this.device = m.device;
          this.isolated = m.isolated;
          worker.onmessage = (e: MessageEvent<WorkerResponse>) => this.onWorkerMessage(e.data);
          resolve();
        } else if (m.type === 'error') reject(new Error(m.message));
      };
      worker.onerror = (e) => reject(new Error(e.message || 'Speech worker failed to start'));
      worker.postMessage({
        type: 'load',
        model: model.id,
        baseUrl: modelBaseUrl(),
        device: this.planned ?? 'wasm',
      } satisfies WorkerRequest);
    });
  }

  async start(): Promise<void> {
    if (!this.worker) throw new Error('Call load() first');
    if (this.stream) return; // already listening
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    const context = new AudioContext();
    this.context = context;
    await context.audioWorklet.addModule('/worklets/capture-processor.js');
    const source = context.createMediaStreamSource(this.stream);
    const capture = new AudioWorkletNode(context, 'capture-processor');
    this.transcriber = new StreamingTranscriber(
      (job) => this.transcribe(job),
      (words) => {
        if (window.__TILAWAH_SPEECH_DEBUG__)
          performance.mark('tilawah:words', { detail: words.join(' ') });
        this.partial(words);
      },
    );
    capture.port.onmessage = (event: MessageEvent<Float32Array>) =>
      this.transcriber?.push(event.data);
    source.connect(capture);
  }

  async stop(): Promise<void> {
    // The last phrase is transcribed once more; its words still arrive after stopping.
    this.transcriber?.flush();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    await this.context?.close().catch(() => undefined);
    this.context = null;
  }

  onPartial(cb: (words: string[]) => void): void {
    this.partial = cb;
  }

  onError(cb: (e: Error) => void): void {
    this.error = cb;
  }

  /** Frees the model (call when leaving the practice screen). */
  dispose(): void {
    void this.stop();
    this.worker?.terminate();
    this.worker = null;
    this.loading = null;
  }

  /** True while the user is speaking or a phrase is still being recognised. */
  isBusy(): boolean {
    return this.transcriber?.busy ?? false;
  }

  private transcribe(job: TranscriptionJob): void {
    if (!this.worker) return;
    this.sentAt = performance.now();
    this.worker.postMessage(
      { type: 'transcribe', id: job.id, audio: job.audio } satisfies WorkerRequest,
      [job.audio.buffer],
    );
  }

  private onWorkerMessage(message: WorkerResponse): void {
    if (message.type === 'result') {
      this.failures = 0;
      // Visible in the browser's performance panel and to the measurement script (MEMORIZATION.md).
      performance.measure('tilawah:recognize', {
        start: this.sentAt,
        end: performance.now(),
        // The evaluation script opts in to see transcripts; they stay in this page either way.
        detail: window.__TILAWAH_SPEECH_DEBUG__
          ? `${String(message.id)}: ${message.text}`
          : undefined,
      });
      this.transcriber?.result(message.id, message.text);
    } else if (message.type === 'error') {
      this.failures += 1;
      // One bad pass is skipped; repeated failures mean recognition is not working at all.
      if (this.failures >= 3) this.error(new Error(message.message));
      if (message.id !== undefined) this.transcriber?.failed(message.id);
    }
  }
}

export { BASE_MODEL, TINY_MODEL };
