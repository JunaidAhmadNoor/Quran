'use client';
// The memorization screen: the ayahs are hidden, the user recites from memory, and on-device
// speech recognition reveals each word as it is said. Only word positions are ever saved; the
// audio and the recognised words never leave the browser.
import { MAX_MISTAKES_PER_SESSION, type MemorizationMode } from '@tilawah/contracts';
import {
  RecitationMatcher,
  expectedWordsFrom,
  type MatcherEvent,
  type WordState,
} from '@tilawah/recitation';
import { Ear, Lightbulb, Mic, RotateCcw, Square, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/misc';
import { AyahMarker } from '@/components/ui/ornaments';
import { api } from '@/lib/api';
import { usePlayer } from '@/lib/player-store';
import {
  acquireEngine,
  isModelCached,
  releaseEngine,
  type PracticeEngine,
} from '@/lib/speech/create-engine';
import { cn } from '@/lib/utils';

export interface PracticeAyah {
  number: number;
  words: { position: number; text: string }[];
}

interface Props {
  surah: number;
  ayahs: PracticeAyah[];
  /** Single-ayah recitations by ayah number, for "listen then repeat". */
  listenUrls: Record<number, string>;
  signedIn: boolean;
  initialMode?: MemorizationMode;
}

type Phase = 'setup' | 'loading' | 'preparing' | 'active' | 'summary';
type ListenStage = 'playing' | 'reciting' | 'no-recording';
type SaveState = 'saving' | 'saved' | 'local' | 'failed' | null;
type PracticeError = 'mic-denied' | 'engine-failed' | null;

const MODES: { value: MemorizationMode; label: string; hint: string }[] = [
  { value: 'reveal', label: 'modeReveal', hint: 'modeRevealHint' },
  { value: 'check_ayah', label: 'modeCheck', hint: 'modeCheckHint' },
  { value: 'listen_repeat', label: 'modeListen', hint: 'modeListenHint' },
];

const LOCAL_KEY = 'tilawah.memorization.sessions';
const TEXT_KEY = 'tilawah.memorize.text';
type TextMode = 'faint' | 'hidden';

/** The Faint/Hidden choice, remembered in this browser (server render: faint). */
const textModeStore = {
  subscribe: (cb: () => void) => {
    window.addEventListener('storage', cb);
    window.addEventListener(TEXT_KEY, cb);
    return () => {
      window.removeEventListener('storage', cb);
      window.removeEventListener(TEXT_KEY, cb);
    };
  },
  get: (): TextMode => {
    try {
      return localStorage.getItem(TEXT_KEY) === 'hidden' ? 'hidden' : 'faint';
    } catch {
      return 'faint';
    }
  },
  set: (mode: TextMode) => {
    try {
      localStorage.setItem(TEXT_KEY, mode);
    } catch {
      // Storage unavailable: the choice lasts for this page only.
    }
    window.dispatchEvent(new Event(TEXT_KEY));
  },
};
const LOCAL_LIMIT = 100;

interface Result {
  wordsTotal: number;
  wordsCorrect: number;
  mistakes: { ayah: number; word: number; type: 'missed' | 'hinted' }[];
}

function saveLocally(entry: object): void {
  try {
    const list = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]') as object[];
    list.push(entry);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(-LOCAL_LIMIT)));
  } catch {
    // Private windows and full storage: the summary is still shown.
  }
}

export function Practice({ surah, ayahs, listenUrls, signedIn, initialMode = 'reveal' }: Props) {
  const t = useTranslations('memorize');
  const ts = useTranslations('surah');
  const locale = useLocale();
  const expected = useMemo(() => expectedWordsFrom(ayahs), [ayahs]);
  const ayahFrom = ayahs[0]?.number ?? 1;
  const ayahTo = ayahs.at(-1)?.number ?? ayahFrom;

  const [mode, setMode] = useState<MemorizationMode>(initialMode);
  const textMode = useSyncExternalStore(textModeStore.subscribe, textModeStore.get, () => 'faint');
  const faint = textMode === 'faint';
  const [phase, setPhase] = useState<Phase>('setup');
  const [states, setStates] = useState<WordState[]>(() => expected.map(() => 'hidden'));
  const [progress, setProgress] = useState(0);
  const [cached, setCached] = useState(false);
  const [hint, setHint] = useState<{ index: number; level: 1 | 2; text: string } | null>(null);
  const [wrongAyah, setWrongAyah] = useState<{ heard: number; expected: number } | null>(null);
  const [pulse, setPulse] = useState(0);
  const [listen, setListen] = useState<{ ayah: number; stage: ListenStage } | null>(null);
  const [error, setError] = useState<PracticeError>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [save, setSave] = useState<SaveState>(null);
  const [device, setDevice] = useState<string | null>(null);
  const [sizeMb, setSizeMb] = useState<number | null>(null);

  // Session state read by engine callbacks: kept in refs so callbacks never see stale values.
  const session = useRef({
    engine: null as PracticeEngine | null,
    matcher: null as RecitationMatcher | null,
    active: false,
    mode: initialMode,
    startedAt: new Date(),
    tick: 0,
    audio: null as HTMLAudioElement | null,
    listenAyah: 0,
  });
  /** Read through a function: TypeScript would otherwise assume it cannot change across an await. */
  const isActive = () => session.current.active;

  // The matcher's pointer is always the first word not yet reached.
  const nextIndex = phase === 'active' ? states.indexOf('hidden') : -1;
  const done = states.filter((s) => s !== 'hidden').length;
  const correct = states.filter((s) => s === 'correct').length;
  const pct = done === 0 ? 100 : Math.round((correct / done) * 100);

  const stopListening = useCallback(() => {
    const s = session.current;
    window.clearInterval(s.tick);
    s.tick = 0;
    s.audio?.pause();
    void s.engine?.stop().catch(() => undefined);
  }, []);

  const persist = useCallback(
    async (summary: Result) => {
      const s = session.current;
      const body = {
        surah,
        ayahFrom,
        ayahTo,
        mode: s.mode,
        wordsTotal: summary.wordsTotal,
        wordsCorrect: summary.wordsCorrect,
        mistakes: summary.mistakes.slice(0, MAX_MISTAKES_PER_SESSION),
        startedAt: s.startedAt.toISOString(),
        endedAt: new Date().toISOString(),
      };
      if (!signedIn) {
        saveLocally(body);
        setSave('local');
        return;
      }
      setSave('saving');
      try {
        await api.createMemorizationSession({ body });
        setSave('saved');
      } catch {
        saveLocally(body);
        setSave('failed');
      }
    },
    [ayahFrom, ayahTo, signedIn, surah],
  );

  const finish = useCallback(() => {
    const s = session.current;
    const matcher = s.matcher;
    if (!s.active || !matcher) return;
    s.active = false;
    stopListening();
    // Words never reached count as missed, and are revealed in the review colour.
    const final = matcher.wordStates.map((w) => (w === 'hidden' ? 'missed' : w));
    const mistakes: Result['mistakes'] = [];
    final.forEach((state, i) => {
      const w = expected[i];
      if (w && (state === 'missed' || state === 'hinted'))
        mistakes.push({ ayah: w.ayah, word: w.position, type: state });
    });
    const summary = {
      wordsTotal: expected.length,
      wordsCorrect: final.filter((w) => w === 'correct').length,
      mistakes,
    };
    setStates(final);
    setHint(null);
    setWrongAyah(null);
    setListen(null);
    setResult(summary);
    setPhase('summary');
    void persist(summary);
  }, [expected, persist, stopListening]);

  const startTicking = useCallback(() => {
    const s = session.current;
    window.clearInterval(s.tick);
    s.tick = window.setInterval(() => {
      const now = Date.now();
      if (s.engine?.isBusy?.()) s.matcher?.touch(now);
      const events = s.matcher?.tick(now) ?? [];
      for (const e of events) if (e.type === 'hint') setHint(e);
    }, 500);
  }, []);

  const startMic = useCallback(async () => {
    const s = session.current;
    if (!s.engine || !s.active) return;
    try {
      await s.engine.start();
      if (!isActive()) {
        await s.engine.stop();
        return;
      }
      setDevice(s.engine.device ?? null);
      setPhase('active');
      startTicking();
    } catch (e) {
      const name = (e as { name?: string }).name;
      s.active = false;
      stopListening();
      setError(
        name === 'NotAllowedError' || name === 'SecurityError' ? 'mic-denied' : 'engine-failed',
      );
      setPhase('setup');
    }
  }, [startTicking, stopListening]);

  /** Listen-then-repeat: play the reciter (microphone off), then listen to the user. */
  const playAyah = useCallback(
    (ayah: number) => {
      const s = session.current;
      s.listenAyah = ayah;
      window.clearInterval(s.tick);
      void s.engine?.stop().catch(() => undefined);
      const url = listenUrls[ayah];
      if (!url) {
        setListen({ ayah, stage: 'no-recording' });
        void startMic();
        return;
      }
      setListen({ ayah, stage: 'playing' });
      setPhase('active');
      s.audio ??= new Audio();
      const audio = s.audio;
      const toRecite = () => {
        if (!s.active || s.listenAyah !== ayah) return;
        setListen({ ayah, stage: 'reciting' });
        void startMic();
      };
      audio.onended = toRecite;
      audio.onerror = toRecite; // a broken recording should not block the session
      audio.src = url;
      void audio.play().catch(toRecite);
    },
    [listenUrls, startMic],
  );

  const onEvents = useCallback(
    (events: MatcherEvent[]) => {
      const s = session.current;
      const matcher = s.matcher;
      if (!matcher) return;
      let complete = false;
      for (const e of events) {
        if (e.type === 'revealed') {
          setHint(null);
          setWrongAyah(null);
        } else if (e.type === 'ignored') setPulse((p) => p + 1);
        else if (e.type === 'wrong-ayah')
          setWrongAyah({ heard: e.heardAyah, expected: e.expectedAyah });
        else if (e.type === 'complete') complete = true;
      }
      setStates([...matcher.wordStates]);
      if (complete) {
        finish();
        return;
      }
      if (s.mode === 'listen_repeat') {
        const next = expected[matcher.nextIndex];
        if (next && next.ayah !== s.listenAyah) playAyah(next.ayah);
      }
    },
    [expected, finish, playAyah],
  );

  const begin = useCallback(async () => {
    const s = session.current;
    setError(null);
    usePlayer.getState().setPlaying(false); // the microphone would hear the player
    const engine = (s.engine ??= acquireEngine());
    s.mode = mode;
    s.active = true;

    setPhase('loading');
    setProgress(0);
    if (engine.plan) {
      const plan = await engine.plan();
      setSizeMb(plan.sizeMb);
      setCached(await isModelCached(plan.probeUrl));
    }
    try {
      await engine.load((p) => setProgress(p));
    } catch (e) {
      console.error('Speech model failed to load', e);
      s.active = false;
      setError('engine-failed');
      setPhase('setup');
      return;
    }
    if (!isActive()) return;

    s.matcher = new RecitationMatcher(expected, Date.now());
    s.startedAt = new Date();
    s.listenAyah = 0;
    setStates(expected.map(() => 'hidden'));
    setHint(null);
    setWrongAyah(null);
    setResult(null);
    setSave(null);
    engine.onPartial((words) => {
      if (!s.active || !s.matcher) return;
      onEvents(s.matcher.hear(words, Date.now()));
    });
    engine.onError((e) => {
      // Recognition keeps failing: stop and say so instead of listening silently.
      console.error('Speech recognition failed', e);
      if (!s.active) return;
      s.active = false;
      stopListening();
      setError('engine-failed');
      setPhase('setup');
    });

    if (mode === 'listen_repeat') playAyah(ayahFrom);
    else {
      setPhase('preparing');
      await startMic();
    }
  }, [ayahFrom, expected, mode, onEvents, playAyah, startMic, stopListening]);

  // Leaving the page: microphone off, model released (kept briefly for the next range).
  useEffect(() => {
    const s = session.current;
    return () => {
      s.active = false;
      window.clearInterval(s.tick);
      s.audio?.pause();
      if (s.engine) releaseEngine(s.engine);
    };
  }, []);

  const busy = phase === 'loading' || phase === 'preparing' || phase === 'active';
  const reciting = phase === 'active' && listen?.stage !== 'playing';

  /** In check mode an ayah stays hidden until every word of it has been reached. */
  const ayahClosed = useMemo(() => {
    const open = new Set<number>();
    states.forEach((st, i) => {
      if (st === 'hidden') open.add(expected[i]?.ayah ?? 0);
    });
    return (ayah: number) => !open.has(ayah);
  }, [expected, states]);

  let index = 0;
  const text = (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-end gap-2 text-sm">
        <span id="text-mode" className="text-muted">
          {t('textLabel')}
        </span>
        <div
          role="group"
          aria-labelledby="text-mode"
          className="inline-flex rounded-control border border-border bg-surface p-0.5"
        >
          {(['faint', 'hidden'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={textMode === m}
              title={t('textHint')}
              onClick={() => textModeStore.set(m)}
              className={cn(
                'rounded-[4px] px-3 py-1 transition-colors',
                textMode === m ? 'bg-primary text-primary-contrast' : 'text-muted hover:text-text',
              )}
            >
              {t(m === 'faint' ? 'textFaint' : 'textHidden')}
            </button>
          ))}
        </div>
      </div>
      <div
        lang="ar"
        dir="rtl"
        className="rounded-card border border-border bg-surface px-5 py-8 sm:px-10"
      >
        <p className="quran text-text">
          {ayahs.map((a) => (
            <span key={a.number}>
              {a.words.map((w) => {
                const i = index++;
                const state = states[i] ?? 'hidden';
                const visible =
                  state !== 'hidden' &&
                  (mode !== 'check_ayah' || phase === 'summary' || ayahClosed(a.number));
                return (
                  <Word
                    key={w.position}
                    faint={faint}
                    text={w.text}
                    state={visible ? state : 'hidden'}
                    isNext={i === nextIndex && reciting}
                    hint={hint?.index === i ? hint : null}
                    pulse={i === nextIndex ? pulse : 0}
                    hiddenLabel={t('hiddenWord')}
                    missedLabel={t('mistakeMissed')}
                    hintedLabel={t('mistakeHinted')}
                  />
                );
              })}
              <AyahMarker n={a.number} label={ts('ayahMarker', { n: a.number })} />{' '}
            </span>
          ))}
        </p>
      </div>
    </div>
  );

  if (phase === 'summary' && result) {
    return (
      <Summary
        ayahs={ayahs}
        result={result}
        save={save}
        surah={surah}
        mode={mode}
        locale={locale}
        onAgain={() => void begin()}
      >
        {text}
      </Summary>
    );
  }

  return (
    <div className="space-y-6">
      {phase === 'setup' ? (
        <Card className="p-5">
          <fieldset>
            <legend className="font-medium text-text">{t('modeLabel')}</legend>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {MODES.map((m) => (
                <label
                  key={m.value}
                  className={cn(
                    'flex cursor-pointer flex-col gap-1 rounded-control border p-3 text-sm transition-colors',
                    mode === m.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted',
                  )}
                >
                  <span className="flex items-center gap-2 font-medium text-text">
                    <input
                      type="radio"
                      name="mode"
                      value={m.value}
                      checked={mode === m.value}
                      onChange={() => setMode(m.value)}
                      className="accent-[var(--primary)]"
                    />
                    {t(m.label as 'modeReveal')}
                  </span>
                  <span className="text-muted">{t(m.hint as 'modeRevealHint')}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-5 flex flex-col items-center gap-3">
            <Button
              size="lg"
              className="h-16 rounded-full px-8 text-base"
              onClick={() => void begin()}
            >
              <Mic className="size-6" />
              {t('startReciting')}
            </Button>
            {error ? (
              <p role="alert" className="flex items-start gap-2 text-sm text-danger">
                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                {t(error === 'mic-denied' ? 'micDenied' : 'engineFailed')}
              </p>
            ) : null}
          </div>
        </Card>
      ) : null}

      {phase === 'loading' ? (
        <Card className="p-6 text-center">
          <p className="font-medium text-text">
            {cached || !sizeMb ? t('loadingModel') : t('downloading', { size: sizeMb })}
          </p>
          <div
            role="progressbar"
            aria-label={t('loadingModel')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            className="mx-auto mt-4 h-2 max-w-sm overflow-hidden rounded-full bg-border"
          >
            <div
              className="h-full bg-primary transition-[width] duration-200"
              style={{ width: `${String(Math.round(progress))}%` }}
            />
          </div>
          {!cached ? <p className="mt-3 text-sm text-muted">{t('downloadNote')}</p> : null}
        </Card>
      ) : null}

      {phase === 'preparing' || phase === 'active' ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="relative flex size-20 items-center justify-center">
            {reciting ? (
              <span
                aria-hidden
                className="absolute inset-0 animate-ping rounded-full bg-primary/20 motion-reduce:animate-none"
              />
            ) : null}
            <span
              className={cn(
                'relative flex size-20 items-center justify-center rounded-full',
                listen?.stage === 'playing'
                  ? 'bg-surface-raised text-primary'
                  : 'bg-primary text-primary-contrast',
              )}
            >
              {listen?.stage === 'playing' ? (
                <Ear className="size-8" />
              ) : (
                <Mic className="size-8" />
              )}
            </span>
          </div>
          <p role="status" className="min-h-6 text-sm text-muted">
            {phase === 'preparing'
              ? t('preparing')
              : listen?.stage === 'playing'
                ? t('listenPlaying', { n: listen.ayah })
                : listen?.stage === 'no-recording'
                  ? t('listenNone', { n: listen.ayah })
                  : listen?.stage === 'reciting'
                    ? t('listenYourTurn', { n: listen.ayah })
                    : t('listening')}
          </p>
          <p className="flex gap-3 text-sm text-text tabular-nums">
            <span>{t('progressWords', { done, total: expected.length })}</span>
            <span aria-hidden className="text-border">
              |
            </span>
            <span>{t('accuracyLive', { pct })}</span>
          </p>
          <Button variant="secondary" onClick={finish} disabled={phase !== 'active'}>
            <Square />
            {t('finish')}
          </Button>
        </div>
      ) : null}

      {/* Spoken feedback for screen readers; the visual hint sits on the word itself. */}
      <div aria-live="polite" className="min-h-6 text-center text-sm">
        {wrongAyah ? (
          <p className="inline-flex items-center gap-2 rounded-control border border-danger/40 px-3 py-1 text-danger">
            <TriangleAlert aria-hidden className="size-4" />
            {t('wrongAyah', wrongAyah)}
          </p>
        ) : hint ? (
          <p className="inline-flex items-center gap-2 text-muted">
            <Lightbulb aria-hidden className="size-4 text-accent" />
            {t('hintTitle')}:{' '}
            <span lang="ar" className="font-quran text-lg text-text">
              {hint.text}
            </span>
          </p>
        ) : null}
      </div>

      {text}

      {busy && device ? (
        <p className="text-center text-xs text-muted">
          {t('deviceNote', { device: device === 'webgpu' ? 'WebGPU' : 'WebAssembly' })}
        </p>
      ) : null}
    </div>
  );
}

function Word({
  faint,
  text,
  state,
  isNext,
  hint,
  pulse,
  hiddenLabel,
  missedLabel,
  hintedLabel,
}: {
  faint: boolean;
  text: string;
  state: WordState;
  isNext: boolean;
  hint: { level: 1 | 2; text: string } | null;
  pulse: number;
  hiddenLabel: string;
  missedLabel: string;
  hintedLabel: string;
}) {
  if (state === 'hidden' && faint) {
    // Faint: the word is shown lightly and darkens once recited (decorative until then).
    return (
      <span className="relative me-[0.25em] inline-block">
        <span aria-hidden data-decorative-text className="opacity-30">
          {text}
        </span>
        <span className="sr-only">{hiddenLabel}</span>
        {isNext ? (
          <span
            aria-hidden
            className="absolute inset-x-1 -bottom-1 h-[2px] rounded-full bg-primary/60"
          />
        ) : null}
        {pulse > 0 ? (
          <span
            key={pulse}
            aria-hidden
            className="absolute inset-x-1 -bottom-1 h-[3px] rounded-full bg-danger animate-[miss-pulse_700ms_ease-out_both]"
          />
        ) : null}
      </span>
    );
  }
  if (state === 'hidden') {
    return (
      <span className="relative me-[0.25em] inline-block">
        {/* The word is laid out invisibly so its width is reserved and lines never jump. */}
        <span className="invisible">{text}</span>
        <span
          role="img"
          aria-label={hiddenLabel}
          className={cn(
            'absolute inset-x-0 top-1/2 h-[0.9em] -translate-y-1/2 rounded-full bg-surface-raised',
            isNext && 'ring-1 ring-primary/40',
          )}
        />
        {hint ? (
          <span
            aria-hidden
            className="absolute inset-0 flex items-center justify-center text-muted animate-[fade-in_200ms]"
          >
            {hint.text}
          </span>
        ) : null}
        {pulse > 0 ? (
          // Heard something that is not this word: a brief terracotta underline.
          <span
            key={pulse}
            aria-hidden
            className="absolute inset-x-1 bottom-1 h-[3px] rounded-full bg-danger animate-[miss-pulse_700ms_ease-out_both]"
          />
        ) : null}
      </span>
    );
  }
  return (
    <span
      className={cn(
        'me-[0.25em] inline-block',
        faint
          ? 'animate-[ink-in_260ms_var(--ease-mushaf)_both]'
          : 'animate-[word-in_220ms_var(--ease-mushaf)_both] motion-reduce:animate-[fade-in_150ms_both]',
        state === 'missed' && 'text-danger',
        state === 'hinted' &&
          'text-muted underline decoration-accent decoration-dotted underline-offset-8',
      )}
    >
      {text}
      {state === 'missed' ? <span className="sr-only"> ({missedLabel})</span> : null}
      {state === 'hinted' ? <span className="sr-only"> ({hintedLabel})</span> : null}
    </span>
  );
}

function Summary({
  ayahs,
  result,
  save,
  surah,
  mode,
  locale,
  onAgain,
  children,
}: {
  ayahs: PracticeAyah[];
  result: Result;
  save: SaveState;
  surah: number;
  mode: MemorizationMode;
  locale: string;
  onAgain: () => void;
  children: React.ReactNode;
}) {
  const t = useTranslations('memorize');
  const accuracy = Math.round((result.wordsCorrect / result.wordsTotal) * 100);
  const byAyah = new Map<number, { word: number; type: 'missed' | 'hinted' }[]>();
  for (const m of result.mistakes) byAyah.set(m.ayah, [...(byAyah.get(m.ayah) ?? []), m]);
  const words = new Map(ayahs.map((a) => [a.number, a.words]));
  const mistakeAyahs = [...byAyah.keys()];
  const againHref =
    mistakeAyahs.length > 0
      ? `/memorize/${String(surah)}?from=${String(Math.min(...mistakeAyahs))}&to=${String(Math.max(...mistakeAyahs))}&mode=${mode}`
      : null;
  const number = new Intl.NumberFormat(locale);

  return (
    <div className="space-y-6">
      <Card className="p-6 text-center">
        <h2 className="font-display text-2xl text-text">{t('summaryTitle')}</h2>
        <p className="mt-3 font-display text-5xl text-primary tabular-nums">
          {t('summaryAccuracy', { pct: accuracy })}
        </p>
        <p className="mt-2 text-muted">
          {t('summaryWords', { correct: result.wordsCorrect, total: result.wordsTotal })}
        </p>
        <p role="status" className="mt-3 min-h-5 text-sm text-muted">
          {save === 'saved'
            ? t('saved')
            : save === 'local'
              ? t('savedLocal')
              : save === 'failed'
                ? t('saveFailed')
                : null}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {againHref ? (
            <Button asChild>
              <Link href={againHref}>{t('practiceAgain')}</Link>
            </Button>
          ) : null}
          <Button variant={againHref ? 'secondary' : 'primary'} onClick={onAgain}>
            <RotateCcw />
            {t('tryAgain')}
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/memorize">{t('otherRange')}</Link>
          </Button>
        </div>
      </Card>

      <section aria-labelledby="review-heading">
        <h3 id="review-heading" className="mb-3 font-medium text-text">
          {t('reviewTitle')}
        </h3>
        {byAyah.size === 0 ? (
          <p className="text-muted">{t('reviewEmpty')}</p>
        ) : (
          <ul className="space-y-2">
            {[...byAyah.entries()].slice(0, 60).map(([ayah, list]) => (
              <li
                key={ayah}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-control border border-border bg-surface px-4 py-2"
              >
                <span className="text-sm text-muted">
                  {t('reviewAyah', { n: number.format(ayah) })}
                </span>
                <span lang="ar" dir="rtl" className="flex flex-wrap gap-x-3 font-quran text-2xl">
                  {list.map((m) => (
                    <span
                      key={m.word}
                      className={m.type === 'missed' ? 'text-danger' : 'text-muted'}
                      title={t(m.type === 'missed' ? 'mistakeMissed' : 'mistakeHinted')}
                    >
                      {words.get(ayah)?.find((w) => w.position === m.word)?.text}
                      <span className="sr-only">
                        {' '}
                        ({t(m.type === 'missed' ? 'mistakeMissed' : 'mistakeHinted')})
                      </span>
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {children}
    </div>
  );
}
