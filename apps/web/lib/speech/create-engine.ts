'use client';
import { FakeEngine, type RecognitionEngine } from '@tilawah/recitation';
import { WebSpeechEngine } from './web-engine';

declare global {
  interface Window {
    /** Set by end-to-end tests: words the fake engine "hears", instead of using the microphone. */
    __TILAWAH_FAKE_ENGINE__?: { script: string[]; intervalMs?: number; wordsPerPartial?: number };
    /** Set by scripts/evaluate-speech.mjs: keep transcripts in the performance timeline. */
    __TILAWAH_SPEECH_DEBUG__?: boolean;
  }
}

export type PracticeEngine = RecognitionEngine & {
  dispose?: () => void;
  plan?: () => Promise<{ sizeMb: number; probeUrl: string }>;
  device?: 'webgpu' | 'wasm' | null;
};

/** Keeps a loaded model for a short while after leaving the practice screen, so moving to
 * another range does not reload it; frees it (and its memory) after that. */
const KEEP_MS = 30_000;
let shared: PracticeEngine | null = null;
let disposeTimer = 0;

export function acquireEngine(): PracticeEngine {
  const fake = window.__TILAWAH_FAKE_ENGINE__;
  if (fake)
    return new FakeEngine({
      script: fake.script,
      intervalMs: fake.intervalMs ?? 250,
      wordsPerPartial: fake.wordsPerPartial,
    });
  window.clearTimeout(disposeTimer);
  shared ??= new WebSpeechEngine();
  return shared;
}

export function releaseEngine(engine: PracticeEngine): void {
  void engine.stop().catch(() => undefined);
  if (engine !== shared) return;
  window.clearTimeout(disposeTimer);
  disposeTimer = window.setTimeout(() => {
    shared?.dispose?.();
    shared = null;
  }, KEEP_MS);
}

/** True when the model's files are already in the browser cache (no download needed). */
export async function isModelCached(url: string): Promise<boolean> {
  try {
    return typeof caches !== 'undefined' && (await caches.match(url)) !== undefined;
  } catch {
    return false;
  }
}
