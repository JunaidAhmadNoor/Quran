'use client';
// RecognitionEngine for the browser: microphone → AudioWorklet (16 kHz) → chunker with voice
// activity detection → Whisper in a Web Worker → words. Nothing is uploaded or stored.
import { AudioChunker, freshWords, type RecognitionEngine } from '@tilawah/recitation';
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
  private chunker: AudioChunker | null = null;
  private lastWords: string[] = [];
  private nextId = 0;
  private working = false;
  private queue: { chunk: Float32Array; overlapped: boolean; durationSec: number }[] = [];
  private current = { overlapped: false, durationSec: 0 };
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
    this.lastWords = [];
    this.chunker = new AudioChunker((chunk, info) => this.enqueue(chunk, info.overlapped));
    capture.port.onmessage = (event: MessageEvent<Float32Array>) => this.chunker?.push(event.data);
    source.connect(capture);
  }

  async stop(): Promise<void> {
    this.chunker?.flush();
    this.chunker = null;
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

  /** True while the user is speaking or a segment is still being recognised. */
  isBusy(): boolean {
    return this.working || this.queue.length > 0 || (this.chunker?.speaking ?? false);
  }

  private enqueue(chunk: Float32Array, overlapped: boolean): void {
    // If recognition falls behind, keep only the newest segments so the screen stays responsive.
    this.queue.push({ chunk, overlapped, durationSec: chunk.length / 16_000 });
    if (this.queue.length > 3) this.queue.shift();
    this.pump();
  }

  private pump(): void {
    if (this.working || !this.worker) return;
    const next = this.queue.shift();
    if (!next) return;
    const { chunk } = next;
    this.current = next;
    this.working = true;
    this.sentAt = performance.now();
    this.worker.postMessage(
      { type: 'transcribe', id: this.nextId++, audio: chunk } satisfies WorkerRequest,
      [chunk.buffer],
    );
  }

  private onWorkerMessage(message: WorkerResponse): void {
    if (message.type === 'result') {
      this.working = false;
      this.failures = 0;
      // Visible in the browser's performance panel and to the measurement script (MEMORIZATION.md).
      performance.measure('tilawah:recognize', {
        start: this.sentAt,
        end: performance.now(),
        // The evaluation script opts in to see transcripts; they stay in this page either way.
        detail: window.__TILAWAH_SPEECH_DEBUG__ ? message.text : undefined,
      });
      const words = message.text.trim().split(/\s+/).filter(Boolean);
      const fresh = freshWords(this.lastWords, words, {
        overlapped: this.current.overlapped,
        durationSec: this.current.durationSec,
      });
      this.lastWords = words;
      if (fresh.length > 0) this.partial(fresh);
      this.pump();
    } else if (message.type === 'error') {
      this.working = false;
      this.failures += 1;
      // One bad segment is skipped; repeated failures mean recognition is not working at all.
      if (this.failures >= 3) this.error(new Error(message.message));
      this.pump();
    }
  }
}

export { BASE_MODEL, TINY_MODEL };
