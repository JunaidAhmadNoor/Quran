'use client';
// In-browser recording for the upload page. The audio stays on the device until the user uploads
// it through the normal presigned-URL flow.
import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'paused' | 'stopped';
export type RecorderError = 'denied' | 'no-device' | 'unsupported' | 'failed';

export interface Recording {
  file: File;
  durationSec: number;
  url: string;
}

interface Format {
  /** What MediaRecorder is asked for (may include codecs). */
  recorderType: string;
  /** What the API accepts (no parameters). */
  uploadType: 'audio/webm' | 'audio/mp4' | 'audio/ogg';
  extension: string;
}

const FORMATS: Format[] = [
  { recorderType: 'audio/webm;codecs=opus', uploadType: 'audio/webm', extension: 'webm' },
  { recorderType: 'audio/webm', uploadType: 'audio/webm', extension: 'webm' },
  { recorderType: 'audio/mp4', uploadType: 'audio/mp4', extension: 'm4a' },
  { recorderType: 'audio/ogg;codecs=opus', uploadType: 'audio/ogg', extension: 'ogg' },
];

/** The best format this browser can record that the API also accepts. */
export function pickFormat(isTypeSupported: (type: string) => boolean): Format | null {
  return FORMATS.find((f) => isTypeSupported(f.recorderType)) ?? null;
}

/** Speech at 64 kbps mono: about 0.5 MB per minute. */
const BITS_PER_SECOND = 64_000;

export function useRecorder({ maxSeconds, maxBytes }: { maxSeconds: number; maxBytes: number }) {
  const [state, setState] = useState<RecorderState>('idle');
  const [error, setError] = useState<RecorderError | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [recording, setRecording] = useState<Recording | null>(null);

  const refs = useRef({
    recorder: null as MediaRecorder | null,
    stream: null as MediaStream | null,
    audioContext: null as AudioContext | null,
    chunks: [] as Blob[],
    bytes: 0,
    accumulatedMs: 0,
    startedAt: 0,
    timer: 0,
    frame: 0,
    format: null as Format | null,
  });

  /** Recorded time so far: banked segments plus the running one. */
  const elapsedMs = () => {
    const r = refs.current;
    return r.accumulatedMs + (r.recorder?.state === 'recording' ? Date.now() - r.startedAt : 0);
  };

  const release = useCallback(() => {
    const r = refs.current;
    window.clearInterval(r.timer);
    cancelAnimationFrame(r.frame);
    r.stream?.getTracks().forEach((t) => t.stop()); // turns off the browser's microphone indicator
    r.stream = null;
    void r.audioContext?.close().catch(() => undefined);
    r.audioContext = null;
    setLevel(0);
  }, []);

  const stop = useCallback(() => {
    const r = refs.current;
    if (!r.recorder || r.recorder.state === 'inactive') return;
    // The recorder is already 'inactive' when its stop event fires, so bank the running segment now.
    if (r.recorder.state === 'recording') r.accumulatedMs += Date.now() - r.startedAt;
    r.startedAt = Date.now();
    r.recorder.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (
      typeof MediaRecorder === 'undefined' ||
      !(navigator.mediaDevices as MediaDevices | undefined)?.getUserMedia
    ) {
      setError('unsupported');
      return;
    }
    const format = pickFormat((type) => MediaRecorder.isTypeSupported(type));
    if (!format) {
      setError('unsupported');
      return;
    }
    setState('requesting');
    let stream: MediaStream;
    try {
      // Natural voice for tajweed: no echo cancellation or noise suppression shaping the sound.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
        },
      });
    } catch (e) {
      const name = (e as { name?: string }).name;
      setError(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'denied'
          : name === 'NotFoundError'
            ? 'no-device'
            : 'failed',
      );
      setState('idle');
      return;
    }

    try {
      const r = refs.current;
      Object.assign(r, {
        stream,
        format,
        chunks: [],
        bytes: 0,
        accumulatedMs: 0,
        startedAt: Date.now(),
      });
      const recorder = new MediaRecorder(stream, {
        mimeType: format.recorderType,
        audioBitsPerSecond: BITS_PER_SECOND,
      });
      r.recorder = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size === 0) return;
        r.chunks.push(event.data);
        r.bytes += event.data.size;
        if (r.bytes > maxBytes * 0.97) stop(); // stay under the upload limit
      };
      recorder.onstop = () => {
        const durationSec = Math.round(elapsedMs() / 100) / 10;
        const blob = new Blob(r.chunks, { type: format.uploadType });
        const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
        const file = new File([blob], `recording-${stamp}.${format.extension}`, {
          type: format.uploadType,
        });
        release();
        setRecording({ file, durationSec, url: URL.createObjectURL(blob) });
        setElapsed(durationSec);
        setState('stopped');
      };
      recorder.onerror = () => {
        release();
        setError('failed');
        setState('idle');
      };

      // Live level meter (optional: skipped where Web Audio is unavailable).
      if (typeof AudioContext !== 'undefined') {
        const context = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        context.createMediaStreamSource(stream).connect(analyser);
        r.audioContext = context;
        const samples = new Uint8Array(analyser.fftSize);
        let last = 0;
        const tick = (now: number) => {
          if (now - last > 66) {
            last = now;
            analyser.getByteTimeDomainData(samples);
            let sum = 0;
            for (const s of samples) sum += ((s - 128) / 128) ** 2;
            setLevel(Math.min(1, Math.sqrt(sum / samples.length) * 3));
          }
          r.frame = requestAnimationFrame(tick);
        };
        r.frame = requestAnimationFrame(tick);
      }

      recorder.start(1000); // a chunk every second, so the size limit is watched while recording
      r.timer = window.setInterval(() => {
        const ms = elapsedMs();
        setElapsed(ms / 1000);
        if (ms >= maxSeconds * 1000) stop();
      }, 250);
      setState('recording');
    } catch (e) {
      // Never leave the UI stuck in 'requesting' or the microphone on after an unexpected failure.
      console.error('Recorder failed to start', e);
      release();
      setError('failed');
      setState('idle');
    }
  }, [maxBytes, maxSeconds, release, stop]);

  const pause = useCallback(() => {
    const r = refs.current;
    if (r.recorder?.state !== 'recording') return;
    r.accumulatedMs += Date.now() - r.startedAt;
    r.recorder.pause();
    setState('paused');
  }, []);

  const resume = useCallback(() => {
    const r = refs.current;
    if (r.recorder?.state !== 'paused') return;
    r.startedAt = Date.now();
    r.recorder.resume();
    setState('recording');
  }, []);

  const reset = useCallback(() => {
    if (recording) URL.revokeObjectURL(recording.url);
    setRecording(null);
    setElapsed(0);
    setError(null);
    setState('idle');
  }, [recording]);

  // Never leave the microphone on after leaving the page.
  useEffect(
    () => () => {
      const recorder = refs.current.recorder;
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null;
        recorder.stop();
      }
      release();
    },
    [release],
  );

  return { state, error, elapsed, level, recording, start, pause, resume, stop, reset };
}
