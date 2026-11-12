'use client';
import { MAX_UPLOAD_BYTES } from '@tilawah/contracts';
import { Mic, Pause, Play, RotateCcw, ShieldCheck, Square } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useRecorder, type RecorderError } from '@/lib/recorder';
import { cn, formatBytes, formatDuration } from '@/lib/utils';

/** Recordings shorter than this fall under the server's minimum file size. */
export const MIN_RECORDING_SEC = 3;
const MAX_RECORDING_SEC = 60 * 60;

const ERROR_KEY: Record<
  RecorderError,
  'recordDenied' | 'recordNoDevice' | 'recordUnsupported' | 'recordFailed'
> = {
  denied: 'recordDenied',
  'no-device': 'recordNoDevice',
  unsupported: 'recordUnsupported',
  failed: 'recordFailed',
};

export function Recorder({
  onUse,
  onChooseFile,
}: {
  onUse: (file: File, durationSec: number) => void;
  onChooseFile: () => void;
}) {
  const t = useTranslations('upload');
  const locale = useLocale();
  const rec = useRecorder({ maxSeconds: MAX_RECORDING_SEC, maxBytes: MAX_UPLOAD_BYTES });
  const live = rec.state === 'recording' || rec.state === 'paused';

  return (
    <div className="space-y-4 rounded-card border border-border bg-surface p-6">
      {rec.state !== 'stopped' ? (
        <div className="flex flex-col items-center text-center">
          <div
            role="timer"
            aria-label={t('recordTimer')}
            className="font-display text-5xl text-text tabular-nums"
            dir="ltr"
          >
            {formatDuration(rec.elapsed)}
          </div>
          <p role="status" className="mt-2 flex h-5 items-center gap-2 text-sm text-muted">
            {rec.state === 'recording' ? (
              <>
                <span aria-hidden className="size-2 animate-pulse rounded-full bg-danger" />
                {t('recordingNow')}
              </>
            ) : rec.state === 'paused' ? (
              t('recordPaused')
            ) : null}
          </p>
          {/* Level meter: visual feedback only. */}
          <div aria-hidden className="mt-3 h-1.5 w-48 overflow-hidden rounded-full bg-border">
            <div
              className="h-full bg-primary transition-[width] duration-75"
              style={{ width: `${String(Math.round(rec.level * 100))}%` }}
            />
          </div>

          <div className="mt-6 flex items-center gap-3">
            {!live ? (
              <Button
                size="lg"
                className="rounded-full"
                onClick={() => void rec.start()}
                disabled={rec.state === 'requesting'}
              >
                <Mic />
                {t('recordStart')}
              </Button>
            ) : (
              <>
                {rec.state === 'recording' ? (
                  <Button
                    variant="secondary"
                    size="lg"
                    className="rounded-full"
                    onClick={rec.pause}
                  >
                    <Pause />
                    {t('recordPause')}
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="lg"
                    className="rounded-full"
                    onClick={rec.resume}
                  >
                    <Play />
                    {t('recordResume')}
                  </Button>
                )}
                <Button size="lg" className="rounded-full" onClick={rec.stop}>
                  <Square />
                  {t('recordStop')}
                </Button>
              </>
            )}
          </div>
          {!live ? <p className="mt-4 max-w-sm text-sm text-muted">{t('recordHint')}</p> : null}
        </div>
      ) : rec.recording ? (
        <div className="space-y-4">
          <p className="font-medium text-text">
            {t('recordReady', { duration: formatDuration(rec.recording.durationSec) })}
            <span className="text-muted"> · {formatBytes(rec.recording.file.size, locale)}</span>
          </p>
          <audio
            controls
            src={rec.recording.url}
            className="w-full"
            aria-label={t('recordPreview')}
          />
          {rec.recording.durationSec < MIN_RECORDING_SEC ? (
            <p role="alert" className="text-sm text-danger">
              {t('recordTooShort')}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="secondary" onClick={rec.reset}>
              <RotateCcw />
              {t('recordAgain')}
            </Button>
            <Button
              disabled={rec.recording.durationSec < MIN_RECORDING_SEC}
              onClick={() => {
                if (rec.recording) onUse(rec.recording.file, rec.recording.durationSec);
              }}
            >
              {t('recordUse')}
            </Button>
          </div>
        </div>
      ) : null}

      {rec.error ? (
        <div role="alert" className="space-y-2 text-center text-sm text-danger">
          <p>{t(ERROR_KEY[rec.error])}</p>
          <Button variant="link" onClick={onChooseFile}>
            {t('sourceFile')}
          </Button>
        </div>
      ) : null}

      <p
        className={cn(
          'flex items-start justify-center gap-2 text-xs text-muted',
          live && 'invisible',
        )}
      >
        <ShieldCheck aria-hidden className="mt-0.5 size-3.5 shrink-0 text-primary" />
        {t('recordPrivacy')}
      </p>
    </div>
  );
}
