# Memorization

The memorize section hides a range of ayahs and reveals each word as the user recites it from
memory. Recognition runs entirely on the device: the microphone audio and the recognized words
never leave the browser, and only word positions of mistakes are saved.

## Pipeline

```
microphone ──► AudioWorklet ──► AudioChunker ──► Web Worker ──────────────► RecitationMatcher ──► screen
 (getUserMedia)  capture-processor   segments at    transformers.js + ONNX     window of 3 words,     word states,
                 mono, 16 kHz        pauses, VAD    Runtime Web: Whisper       similarity ≥ 0.8,      hints, summary
                                                    (WebGPU or WebAssembly)    hints, wrong ayah
```

| Piece               | Where                                           | What it does                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RecognitionEngine` | `packages/recitation/src/engine.ts`             | The contract the screen talks to: `load(onProgress)`, `start`, `stop`, `onPartial`, `onError`, `isBusy`. The future mobile app (whisper.rn) implements the same interface.                                                                                                                                                                                                                                                                |
| `FakeEngine`        | same file                                       | Emits scripted words on a timer. Used by unit, component and Playwright tests (`window.__TILAWAH_FAKE_ENGINE__`).                                                                                                                                                                                                                                                                                                                         |
| Capture worklet     | `apps/web/public/worklets/capture-processor.js` | Mixes to mono and resamples the microphone to 16 kHz off the main thread.                                                                                                                                                                                                                                                                                                                                                                 |
| `AudioChunker`      | `packages/recitation/src/chunker.ts`            | Energy-based voice activity detection on 50 ms frames. A segment ends at a pause of 0.35 s (reciters pause between phrases, so words are rarely cut); continuous speech is cut at 5 s with 0.8 s overlap. Silence is never sent to the model.                                                                                                                                                                                             |
| `dropOverlap`       | `packages/recitation/src/stitch.ts`             | Removes words repeated by the overlap of a segment cut mid-speech (only those segments).                                                                                                                                                                                                                                                                                                                                                  |
| Worker              | `apps/web/lib/speech/whisper.worker.ts`         | Loads the model with transformers.js (WebGPU first, then WebAssembly) and transcribes each segment with `language: arabic`.                                                                                                                                                                                                                                                                                                               |
| `WebSpeechEngine`   | `apps/web/lib/speech/web-engine.ts`             | Microphone, worklet, chunker, a small queue to the worker (the newest 3 segments if recognition falls behind), and the tiny-model fallback.                                                                                                                                                                                                                                                                                               |
| `RecitationMatcher` | `packages/recitation/src/matcher.ts`            | Pure and deterministic: compares each heard word with the next 3 hidden words after Arabic normalization; skipped words become `missed`; unmatched words are ignored; isti'adha and basmala said before the range are filtered; hints after 6 s and 12 s without progress (postponed while the user is still speaking or a segment is still being recognized); three consecutive words from another ayah raise "That sounds like ayah N". |
| Practice screen     | `apps/web/components/memorize/practice.tsx`     | Modes, download progress, microphone state, live counter, hints, summary, saving.                                                                                                                                                                                                                                                                                                                                                         |

## Practice modes

| Mode                                 | Behaviour                                                                                                                                                                                                                                                                   |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reveal as I recite (`reveal`)        | Each word appears as soon as it is recognized.                                                                                                                                                                                                                              |
| Check after each ayah (`check_ayah`) | An ayah stays hidden until every word of it has been reached, then shows correct, hinted and missed words.                                                                                                                                                                  |
| Listen then repeat (`listen_repeat`) | For each ayah, plays an approved community recitation of exactly that ayah (microphone off), then listens. Recitations have no per-ayah timestamps, so only single-ayah recitations can be used; for ayahs without one the screen says so and the user recites from memory. |

The screen pauses the site's player before listening, so the microphone does not hear it.
Finishing early counts the words not reached as missed. The summary shows accuracy (correct ÷
total; hinted and missed words are not correct), the words to review grouped by ayah, "Practise
these again" (the smallest range containing every mistake, same mode) and "Try again".

**Saving:** signed in → `POST /api/v1/me/memorization/sessions` (positions and counts only; the
server checks the word count against quran-data and updates progress). Signed out → the same
record in `localStorage` (`tilawah.memorization.sessions`, last 100), and the summary suggests
signing in. If the request fails, the session is kept locally and the summary says so.

## Model

[Tarteel's Whisper fine-tunes for Quran recitation](https://huggingface.co/tarteel-ai), Apache 2.0,
converted with `tools/speech-model/convert.py` (Optimum export, dynamic uint8 quantization of
MatMul, Gemm and Gather including the merged decoder's subgraphs; Conv stays float because ONNX
Runtime Web has no `ConvInteger`).

| Model                   | Revision   | WebGPU files | WebAssembly files | Used when                                                     |
| ----------------------- | ---------- | ------------ | ----------------- | ------------------------------------------------------------- |
| `whisper-base-ar-quran` | `5c3c53fd` | 142 MB       | 110 MB            | default                                                       |
| `whisper-tiny-ar-quran` | `c3d7e624` | 72 MB        | 67 MB             | `navigator.deviceMemory ≤ 4`, or the base model fails to load |

Each device downloads only its own variant:

- **WebGPU** (Chrome/Edge with a GPU): fp32 encoder + 4-bit decoder (`MatMulNBits`, embedding
  uint8), built by `tools/speech-model/quantize_gpu.py`. The uint8 variant cannot be used here:
  ONNX Runtime's WebGPU backend has no integer MatMul kernels, so it stalls (seen in testing).
- **WebAssembly** (everything else): uint8, multithreaded when cross-origin isolated.

The device is chosen before the download, so the screen shows the right size. If the GPU fails to
create the session, the worker falls back to WebAssembly. After loading, one second of silence is
transcribed to compile kernels (shaders on WebGPU), so the user's first phrase is not slow.

The first practice shows "Downloading the recitation model (about N MB)" with progress; files
are then kept in the Cache API (`useBrowserCache`) and work offline. If the model is already
cached the screen says "Loading the recitation model…" instead.

**ONNX Runtime Web** binaries are self-hosted from `/ort/` (copied from the installed
`onnxruntime-web` by `scripts/copy-ort.mjs` before `dev` and `build`; gitignored), never from a
CDN. Two builds are served: `asyncify` (WebGPU and WebAssembly, the default) and the plain one
(Safari below 26 without WebGPU).

### Hosting

- **Development:** files in `apps/web/public/models/<model>/` (gitignored), served by Next.js.
- **Production:** upload `tools/speech-model/out/<model>/` to a public bucket path (R2 with a custom
  domain or `r2.dev`), set `NEXT_PUBLIC_SPEECH_MODEL_BASE_URL` (for example
  `https://models.example.com`) before `pnpm build`. Serve with
  `Cache-Control: public, max-age=31536000, immutable` and CORS allowing `GET` from the site. The
  base and tiny folders together are 177 MB of the R2 free tier's 10 GB.

### Browser requirements and headers

- **Content-Security-Policy** (`proxy.ts`): `script-src` includes `'wasm-unsafe-eval'` (WebAssembly
  compilation; it does not allow JavaScript `eval`); `connect-src` adds the model origin when
  `NEXT_PUBLIC_SPEECH_MODEL_BASE_URL` is set; `worker-src 'self' blob:`.
- **Cross-origin isolation** (`next.config.ts`): `Cross-Origin-Opener-Policy: same-origin` and
  `Cross-Origin-Embedder-Policy: credentialless` on every response. This enables
  `SharedArrayBuffer`, so ONNX Runtime uses several threads for WebAssembly. `credentialless` still
  loads cross-origin images and audio (without cookies), so R2 audio and Google avatars keep
  working. Safari ignores `credentialless` and runs single-threaded.
- **Microphone:** `Permissions-Policy: microphone=(self)`. Denied permission shows a message
  pointing to the site settings. Echo cancellation and noise suppression are on for recognition
  (unlike the upload recorder, which keeps the natural voice).

## Measured accuracy and latency

Measured with `scripts/evaluate-speech.mjs` on 10 recordings (10 reciters from everyayah.com,
239 words: Al-Fatiha twice, Al-Ikhlas, Al-Falaq, An-Nas, Al-Kawthar, Al-Asr, Ayat al-Kursi, An-Nasr,
Al-Qadr). Each recording becomes Chromium's microphone; the real page runs end to end on an Apple
M-series Mac. Accuracy is words revealed as correct ÷ words in the range (any word the user would
see as missed counts against it). Recognition time is from sending a segment to the worker until its
text returns.

| Run                                              | Accuracy        | Recognition per segment (median / p90) |
| ------------------------------------------------ | --------------- | -------------------------------------- |
| WebGPU, normal pace (0.8 s between ayahs)        | 94.6% (226/239) | 0.67 s / 0.84 s                        |
| WebGPU, fast (1.25× speed, 0.15 s between ayahs) | 95.4% (228/239) | 0.69 s / 0.93 s                        |
| WebAssembly, normal pace                         | 95.4% (228/239) | 1.57 s / 1.77 s                        |
| WebAssembly, fast                                | 97.1% (232/239) | 1.56 s / 1.76 s                        |

A word appears about 0.35 s (the pause that ends a segment) plus the recognition time after the
reciter pauses: about 1 s on WebGPU, 2 s on WebAssembly. Continuous recitation is cut every 5 s at
most. Recognition keeps up with fast recitation on both devices.

Fixes found by the evaluation (each measured):

| Change                                                                                  | Effect                                                                 |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Segments end at pauses instead of every 2.5 s                                           | Al-Ikhlas 80% → 100% (words were cut in half)                          |
| Hints wait while speech is buffered or being recognized                                 | No false hints on correct recitation                                   |
| Cross-origin isolation (threads for WebAssembly)                                        | 4.0 s → 1.6 s per segment                                              |
| Dagger alef compared as ا too (مَـٰلِكِ = "مالك")                                       | 90.8% → 95.4%                                                          |
| A short single-word echo of the last word is dropped                                    | Prevents false skips where the word recurs                             |
| Re-sync after dropped words (2 consecutive words within the next 10, same or next ayah) | The session no longer gets stuck when several words are not recognized |
| WebGPU variant (fp32 encoder + 4-bit decoder)                                           | 1.6 s → 0.67 s per segment on GPUs                                     |
| 3.5 s maximum segment (tried, reverted)                                                 | 91.6%: long madd and words were cut                                    |

Remaining errors are recognition misses on short words (فِى, مِّن, إِنَّهُۥ) and some segment ends.

## Tests

| Layer                                      | What                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit (`packages/recitation`)               | Normalization, similarity, matcher (reveal, skips, ignored words, hints and their postponement, wrong ayah, opening phrases, summary), `FakeEngine`, `AudioChunker` (pause segmentation, short words, maximum length with overlap, small worklet frames, silence, flush), `dropOverlap`.                            |
| Component (`practice.test.tsx`)            | FakeEngine drives the screen: modes, live reveal and counter, check mode keeps the ayah hidden, finish early, summary, review list in the review colour, "Practise these again" link, saving to the API (positions only, never words) and to `localStorage`, listen mode without a recording, the player is paused. |
| End to end (`e2e/memorize.spec.ts`)        | Real page, API and database with FakeEngine: signed-in session saved and visible in progress, "Practise these again" opens the right range; signed-out session kept in the browser. All three browser projects.                                                                                                     |
| Real model (`e2e/speech-model.spec.ts`)    | Opt-in (`E2E_SPEECH_WAV=… pnpm e2e --project=chromium speech-model`): a WAV becomes Chromium's microphone and the real pipeline must reach ≥ 80% on Al-Ikhlas with no CSP violations.                                                                                                                               |
| Evaluation (`scripts/evaluate-speech.mjs`) | The measurements above.                                                                                                                                                                                                                                                                                             |

## Limits and next steps

- **Reciter recordings are not learners.** The evaluation uses professional recitations; people
  reciting from memory hesitate, repeat and make mistakes, and phones pick up room noise. A set
  of real practice recordings (with consent) is needed before quoting accuracy to users.
- **Mistake detection is word-level.** Whisper transcribes words, not tajweed: a mispronounced
  letter that still produces the right word is accepted, and the model may "correct" a learner's
  small slip towards the Quran text it was trained on.
- **Repeated phrases** (for example in Ar-Rahman) can match the next occurrence early; the window
  of 3 words limits the damage.
- **Listen then repeat** needs single-ayah recitations; per-ayah timestamps on uploads would let any
  recitation be used.
- **Mobile app:** implement `RecognitionEngine` with whisper.rn using the same converted weights
  (GGML conversion needed) and reuse the matcher and chunker unchanged.
