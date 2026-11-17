// Speech models for memorization: Tarteel's Whisper fine-tunes for Quran recitation (Apache 2.0),
// converted by tools/speech-model (convert.py: uint8 for WebAssembly; quantize_gpu.py: fp32
// encoder + 4-bit decoder for WebGPU, which has no integer MatMul kernels).

export type SpeechDevice = 'webgpu' | 'wasm';

export interface SpeechModel {
  id: 'whisper-base-ar-quran' | 'whisper-tiny-ar-quran';
  /** Download size per device in MB, shown on the one-time download screen. */
  sizeMb: Record<SpeechDevice, number>;
}

export const BASE_MODEL: SpeechModel = {
  id: 'whisper-base-ar-quran',
  sizeMb: { wasm: 110, webgpu: 142 },
};
export const TINY_MODEL: SpeechModel = {
  id: 'whisper-tiny-ar-quran',
  sizeMb: { wasm: 67, webgpu: 72 },
};

/** transformers.js dtype per device (selects the files under onnx/). */
export const DTYPE = {
  webgpu: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
  wasm: 'q8',
} as const;

/** The encoder file of a device's variant: present in the Cache API once downloaded. */
export const encoderFile = (device: SpeechDevice) =>
  device === 'webgpu' ? 'onnx/encoder_model.onnx' : 'onnx/encoder_model_quantized.onnx';

/** Low-memory devices get the tiny model straight away. */
export function pickModel(): SpeechModel {
  const memory = (navigator as { deviceMemory?: number }).deviceMemory;
  return memory !== undefined && memory <= 4 ? TINY_MODEL : BASE_MODEL;
}

/** Set when recognition stalled on this browser's GPU: WebAssembly is used from then on. */
export const GPU_STALLED_KEY = 'tilawah.speech.gpuStalled';

/** WebGPU when the browser exposes a real adapter (that has not stalled before); otherwise
 * WebAssembly. */
export async function detectDevice(): Promise<SpeechDevice> {
  try {
    if (localStorage.getItem(GPU_STALLED_KEY)) return 'wasm';
  } catch {
    // storage unavailable
  }
  const gpu = (navigator as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  if (!gpu) return 'wasm';
  try {
    return (await gpu.requestAdapter()) ? 'webgpu' : 'wasm';
  } catch {
    return 'wasm';
  }
}

/** Where model files are served from: R2 in production, /models in development. */
export function modelBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SPEECH_MODEL_BASE_URL;
  return (
    configured && configured.length > 0 ? configured : `${window.location.origin}/models`
  ).replace(/\/$/, '');
}
