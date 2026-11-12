// Runs Whisper (transformers.js + ONNX Runtime) off the main thread. Audio never leaves the
// device: the worker only receives 16 kHz samples and returns text.
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';
import { DTYPE, type SpeechDevice } from './models';

export type WorkerRequest =
  | { type: 'load'; model: string; baseUrl: string; device: SpeechDevice }
  | { type: 'transcribe'; id: number; audio: Float32Array };

export type WorkerResponse =
  | { type: 'progress'; pct: number }
  | { type: 'ready'; device: 'webgpu' | 'wasm'; isolated: boolean }
  | { type: 'result'; id: number; text: string }
  | { type: 'error'; message: string; during: 'load' | 'transcribe' };

const post = (message: WorkerResponse) => self.postMessage(message);
let asr: AutomaticSpeechRecognitionPipeline | null = null;

async function load(model: string, baseUrl: string, preferred: SpeechDevice) {
  env.allowLocalModels = false;
  env.remoteHost = `${baseUrl}/`;
  env.remotePathTemplate = '{model}/';
  env.useBrowserCache = true; // Cache API: downloaded once, then offline
  // Serve the ONNX Runtime binaries from this site instead of a public CDN.
  if (env.backends.onnx.wasm) env.backends.onnx.wasm.wasmPaths = `${self.location.origin}/ort/`;

  const loaded = new Map<string, { loaded: number; total: number }>();
  const progress_callback = (event: {
    status: string;
    file?: string;
    loaded?: number;
    total?: number;
  }) => {
    if (event.status !== 'progress' || !event.file || !event.total) return;
    loaded.set(event.file, { loaded: event.loaded ?? 0, total: event.total });
    let done = 0;
    let total = 0;
    for (const f of loaded.values()) {
      done += f.loaded;
      total += f.total;
    }
    post({ type: 'progress', pct: Math.min(99, Math.round((done / total) * 100)) });
  };

  // WebGPU (fp32 encoder + 4-bit decoder) when available, else WebAssembly (uint8). A GPU that
  // fails to create the session falls back to WebAssembly.
  const devices: SpeechDevice[] = preferred === 'webgpu' ? ['webgpu', 'wasm'] : ['wasm'];
  let lastError: unknown;
  for (const device of devices) {
    try {
      const loaded = await pipeline('automatic-speech-recognition', model, {
        device,
        dtype: DTYPE[device],
        progress_callback,
      });
      // Warm-up: the first run compiles kernels (shaders on WebGPU) and is several times slower;
      // do it now instead of on the user's first phrase.
      await loaded(new Float32Array(16_000), { language: 'arabic', task: 'transcribe' });
      asr = loaded;
      post({ type: 'progress', pct: 100 });
      // Cross-origin isolated: ONNX Runtime can use several threads for WebAssembly.
      post({ type: 'ready', device, isolated: self.crossOriginIsolated });
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (message.type === 'load') {
    try {
      await load(message.model, message.baseUrl, message.device);
    } catch (error) {
      post({
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
        during: 'load',
      });
    }
    return;
  }
  try {
    if (!asr) throw new Error('Model not loaded');
    const output = (await asr(message.audio, { language: 'arabic', task: 'transcribe' })) as {
      text: string;
    };
    post({ type: 'result', id: message.id, text: output.text });
  } catch (error) {
    post({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
      during: 'transcribe',
    });
  }
};
