// Scripted stand-ins for the microphone APIs jsdom lacks.
import { vi } from 'vitest';

export const stopTrack = vi.fn();

class FakeMediaRecorder {
  static supported = ['audio/webm;codecs=opus', 'audio/webm'];
  static isTypeSupported(type: string) {
    return FakeMediaRecorder.supported.includes(type);
  }
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(
    readonly stream: unknown,
    readonly options: { mimeType: string },
  ) {}
  start() {
    this.state = 'recording';
  }
  pause() {
    this.state = 'paused';
  }
  resume() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    // 4 KB per elapsed second of fake audio, so recordings pass the size floor in tests.
    this.ondataavailable?.({
      data: new Blob([new Uint8Array(40_000)], { type: this.options.mimeType }),
    });
    this.onstop?.();
  }
}

export function installFakeMedia({ deny = false }: { deny?: boolean } = {}) {
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: deny
        ? vi.fn().mockRejectedValue(Object.assign(new Error('denied'), { name: 'NotAllowedError' }))
        : vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }),
    },
  });
  URL.createObjectURL = vi.fn(() => 'blob:recording');
  URL.revokeObjectURL = vi.fn();
}

export function uninstallFakeMedia() {
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
}
