// Measures the real memorization pipeline (fake microphone → AudioWorklet → Whisper in a Web
// Worker → matcher) on recordings, in Chromium against a running production build.
//
//   pnpm build && pnpm e2e:server            # in one terminal (port 3100)
//   node scripts/evaluate-speech.mjs [cases.json] [audio-dir]
//
// cases.json: [{ "name", "surah", "from", "to", "files": ["/abs/001001.mp3", ...] }] or, with no
// argument, the built-in set downloaded from everyayah.com into audio-dir (default
// ../../.data/speech-eval). The recordings are used only for measurement and never committed.
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const BASE = process.env.EVAL_BASE_URL ?? 'http://localhost:3100';
const here = new URL('.', import.meta.url).pathname;
const audioDir = resolve(process.argv[3] ?? join(here, '../../../.data/speech-eval'));
const SR = 16_000;
// EVAL_WEBGPU=1: use the GPU (headless Chromium on macOS reaches Metal with --use-angle=metal).
const WEBGPU = process.env.EVAL_WEBGPU === '1';
// Fast recitation: EVAL_GAP=0.15 (seconds between ayahs) and EVAL_RATE=1.25 (playback speed).
const GAP = Number(process.env.EVAL_GAP ?? 0.8);
const RATE = Number(process.env.EVAL_RATE ?? 1);
// EVAL_SQUEEZE=1: remove pauses inside each recitation (silences longer than 0.1 s), so the
// reciter never stops: the hardest case for segmenting at pauses.
const SQUEEZE = process.env.EVAL_SQUEEZE === '1';
// EVAL_GAIN=0.1: a quiet microphone.
const GAIN = Number(process.env.EVAL_GAIN ?? 1);

function squeeze(samples) {
  const frame = SR / 20; // 50 ms
  const out = [];
  let silent = 0;
  for (let i = 0; i < samples.length; i += frame) {
    const part = samples.subarray(i, i + frame);
    let sum = 0;
    for (const x of part) sum += x * x;
    const quiet = Math.sqrt(sum / part.length) < 0.01;
    silent = quiet ? silent + 1 : 0;
    if (silent <= 2) out.push(part);
  }
  const result = new Float32Array(out.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of out) {
    result.set(p, o);
    o += p.length;
  }
  return result;
}

const BUILT_IN = [
  ['Alafasy_128kbps', 1, 1, 7],
  ['Husary_128kbps', 1, 1, 7],
  ['Abdul_Basit_Murattal_192kbps', 112, 1, 4],
  ['Minshawy_Murattal_128kbps', 113, 1, 5],
  ['Abdurrahmaan_As-Sudais_192kbps', 114, 1, 6],
  ['Ghamadi_40kbps', 108, 1, 3],
  ['Saood_ash-Shuraym_128kbps', 103, 1, 3],
  ['MaherAlMuaiqly128kbps', 2, 255, 255],
  ['Muhammad_Ayyoub_128kbps', 110, 1, 3],
  ['Hudhaify_128kbps', 97, 1, 5],
];

const pad = (n) => String(n).padStart(3, '0');

async function builtInCases() {
  const cases = [];
  for (const [reciter, surah, from, to] of BUILT_IN) {
    const dir = join(audioDir, reciter);
    mkdirSync(dir, { recursive: true });
    const files = [];
    for (let a = from; a <= to; a++) {
      const file = join(dir, `${pad(surah)}${pad(a)}.mp3`);
      if (!existsSync(file)) {
        const res = await fetch(`https://everyayah.com/data/${reciter}/${pad(surah)}${pad(a)}.mp3`);
        if (!res.ok) throw new Error(`${reciter} ${surah}:${a}: HTTP ${res.status}`);
        writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      }
      files.push(file);
    }
    cases.push({ name: reciter, surah, from, to, files });
  }
  return cases;
}

/** Decodes the MP3s to 16 kHz mono in the browser and writes one WAV: ayahs with short pauses. */
async function buildWav(page, files, out) {
  const parts = [];
  for (const file of files) {
    const b64 = readFileSync(file).toString('base64');
    const samples = await page.evaluate(
      async ({ b64, sr, rate }) => {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const probe = await new AudioContext().decodeAudioData(bytes.buffer.slice(0));
        const ctx = new OfflineAudioContext(1, Math.ceil((probe.duration / rate) * sr), sr);
        const src = ctx.createBufferSource();
        src.buffer = probe;
        src.playbackRate.value = rate;
        src.connect(ctx.destination);
        src.start();
        return Array.from((await ctx.startRendering()).getChannelData(0));
      },
      { b64, sr: SR, rate: RATE },
    );
    parts.push(SQUEEZE ? squeeze(Float32Array.from(samples)) : Float32Array.from(samples));
  }
  const silence = (s) => new Float32Array(Math.round(s * SR));
  const seq = [silence(1.5)];
  for (const p of parts) seq.push(p, silence(GAP));
  seq.push(silence(5));
  const total = seq.reduce((n, p) => n + p.length, 0);
  const pcm = Buffer.alloc(44 + total * 2);
  pcm.write('RIFF', 0);
  pcm.writeUInt32LE(36 + total * 2, 4);
  pcm.write('WAVEfmt ', 8);
  pcm.writeUInt32LE(16, 16);
  pcm.writeUInt16LE(1, 20);
  pcm.writeUInt16LE(1, 22);
  pcm.writeUInt32LE(SR, 24);
  pcm.writeUInt32LE(SR * 2, 28);
  pcm.writeUInt16LE(2, 32);
  pcm.writeUInt16LE(16, 34);
  pcm.write('data', 36);
  pcm.writeUInt32LE(total * 2, 40);
  let o = 44;
  for (const p of seq)
    for (const x of p) {
      pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x * GAIN)) * 32767), o);
      o += 2;
    }
  writeFileSync(out, pcm);
  return total / SR - 5; // seconds until the recitation ends
}

async function run(c, wav, speechEnd, profile) {
  const context = await chromium.launchPersistentContext(profile, {
    ...(process.env.EVAL_CHANNEL ? { channel: process.env.EVAL_CHANNEL } : {}),
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      `--use-file-for-fake-audio-capture=${wav}%noloop`,
      ...(WEBGPU ? ['--enable-unsafe-webgpu', '--use-angle=metal'] : []),
    ],
    permissions: ['microphone'],
  });
  const page = await context.newPage();
  // Member pages need an account (the E2E stack's seeded reciter).
  await page.goto(BASE);
  await page.request.post(`${BASE}/api/auth/sign-in/email`, {
    data: { email: 'reciter@tilawah.dev', password: 'tilawah-demo-123' },
    headers: { origin: BASE },
  });
  await page.addInitScript(() => {
    window.__TILAWAH_SPEECH_DEBUG__ = true;
  });
  await page.goto(`${BASE}/memorize/${c.surah}?from=${c.from}&to=${c.to}`);
  // Warm the model first (cached after the first case) so timing covers recognition only.
  await page.getByRole('button', { name: 'Start reciting' }).click();
  await page.getByRole('status').filter({ hasText: 'Listening' }).waitFor({ timeout: 300_000 });
  const started = Date.now();
  const device = (await page.getByText(/Speech recognition runs on/).textContent()) ?? '';
  const done = page.getByRole('heading', { name: 'Session complete' });
  try {
    await done.waitFor({ timeout: (speechEnd + 8) * 1000 });
  } catch {
    await page.getByRole('button', { name: 'Finish' }).click();
    await done.waitFor();
  }
  const finishedSec = (Date.now() - started) / 1000;
  const words = await page.getByText(/words recited correctly/).textContent();
  const [correct, total] = (words ?? '').match(/\d+/g).map(Number);
  const review = await page.getByRole('region', { name: 'Words to review' }).innerText();
  const entries = await page.evaluate(() =>
    performance
      .getEntriesByName('tilawah:recognize')
      .map((e) => ({ ms: Math.round(e.duration), text: e.detail })),
  );
  const recognize = entries.map((e) => e.ms);
  const emitted = await page.evaluate(() =>
    performance
      .getEntriesByType('mark')
      .filter((e) => e.name === 'tilawah:words')
      .map((e) => e.detail),
  );
  await context.close();
  return {
    name: c.name,
    range: `${c.surah}:${c.from}-${c.to}`,
    correct,
    total,
    accuracy: correct / total,
    lagSec: Math.max(0, finishedSec - speechEnd),
    recognize,
    device: device.replace(/.*: /, ''),
    transcript: entries.map((e) => e.text).join(' | '),
    emitted: emitted.join(' | '),
    review: review.replace(/\s+/g, ' ').replace('Words to review ', ''),
  };
}

const casesFile = process.argv[2];
const cases = (
  casesFile ? JSON.parse(readFileSync(casesFile, 'utf8')) : await builtInCases()
).filter(
  (c) => !process.env.EVAL_ONLY || process.env.EVAL_ONLY.split(',').includes(String(c.surah)),
);
const work = join(audioDir, '_work');
mkdirSync(work, { recursive: true });
const decoder = await chromium.launch();
const decodePage = await decoder.newPage();
await decodePage.goto('about:blank');
const results = [];
for (const c of cases) {
  const wav = join(work, `${c.name}-${c.surah}.wav`);
  const speechEnd = await buildWav(decodePage, c.files, wav);
  const r = await run(c, wav, speechEnd, join(work, 'profile'));
  console.warn(
    `${r.name.padEnd(32)} ${r.range.padEnd(10)} ${String(r.correct).padStart(3)}/${String(r.total).padEnd(3)} ` +
      `${(r.accuracy * 100).toFixed(0)}%  lag ${r.lagSec.toFixed(1)}s  ${r.review}`,
  );
  results.push(r);
}
await decoder.close();
const all = results.flatMap((r) => r.recognize).sort((a, b) => a - b);
const summary = {
  words: results.reduce((n, r) => n + r.total, 0),
  correct: results.reduce((n, r) => n + r.correct, 0),
  recognizeMedianMs: all[Math.floor(all.length / 2)],
  recognizeP90Ms: all[Math.floor(all.length * 0.9)],
};
console.warn(
  `\nTotal ${summary.correct}/${summary.words} = ${((summary.correct / summary.words) * 100).toFixed(1)}% · ` +
    `recognition median ${summary.recognizeMedianMs} ms, p90 ${summary.recognizeP90Ms} ms`,
);
writeFileSync(
  join(
    audioDir,
    `results-${WEBGPU ? 'webgpu' : 'wasm'}-gap${GAP}-rate${RATE}${SQUEEZE ? '-squeezed' : ''}.json`,
  ),
  JSON.stringify({ summary, results }, null, 2),
);
