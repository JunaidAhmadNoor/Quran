'use client';
import {
  AudioContentType,
  MAX_TITLE_LENGTH,
  MAX_UPLOAD_BYTES,
  RecitationStyle,
  Riwayah,
} from '@tilawah/contracts';
import { surahs } from '@tilawah/quran-data';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, FileAudio } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { ApiError, api } from '@/lib/api';
import { putWithProgress, readDuration } from '@/lib/upload';
import { cn } from '@/lib/utils';

const Details = z
  .object({
    surah: z.coerce.number().int().min(1).max(114),
    ayahFrom: z.coerce.number().int().min(1),
    ayahTo: z.coerce.number().int().min(1),
    title: z.string().trim().min(1).max(MAX_TITLE_LENGTH),
    style: RecitationStyle,
    riwayah: Riwayah,
  })
  .refine((v) => v.ayahFrom <= v.ayahTo && v.ayahTo <= (surahs[v.surah - 1]?.ayahCount ?? 0), {
    path: ['ayahTo'],
    message: 'range',
  });
type DetailsIn = z.input<typeof Details>;
type DetailsOut = z.output<typeof Details>;

type Phase =
  | { step: 'details' }
  | { step: 'file' }
  | { step: 'rights' }
  | { step: 'uploading'; pct: number; confirming: boolean }
  | { step: 'done'; status: 'pending' | 'approved' | 'rejected' | 'removed' };

const STEPS = ['step1', 'step2', 'step3', 'step4'] as const;

export function UploadForm({ initialSurah }: { initialSurah?: number }) {
  const t = useTranslations('upload');
  const styles = useTranslations('styles');
  const riwayat = useTranslations('riwayat');
  const [phase, setPhase] = useState<Phase>({ step: 'details' });
  const [details, setDetails] = useState<DetailsOut | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rights, setRights] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<DetailsIn, unknown, DetailsOut>({
    resolver: zodResolver(Details),
    defaultValues: {
      surah: initialSurah ?? 1,
      ayahFrom: 1,
      ayahTo: surahs[(initialSurah ?? 1) - 1]?.ayahCount ?? 7,
      title: '',
      style: 'murattal',
      riwayah: 'hafs',
    },
  });
  const watchedSurah = useWatch({ control: form.control, name: 'surah' });
  const selectedSurah = surahs[Number(watchedSurah) - 1];
  const stepIndex = { details: 0, file: 1, rights: 2, uploading: 3, done: 3 }[phase.step];

  const chooseFile = (f: File | undefined) => {
    setError(null);
    if (!f) return;
    if (!AudioContentType.safeParse(f.type).success) setError(t('errorType'));
    else if (f.size > MAX_UPLOAD_BYTES) setError(t('errorSize'));
    else setFile(f);
  };

  const upload = async () => {
    if (!details || !file) return;
    setError(null);
    setPhase({ step: 'uploading', pct: 0, confirming: false });
    try {
      const durationSec = await readDuration(file);
      const presign = await api.presignUpload({
        body: {
          surah: details.surah,
          ayahFrom: details.ayahFrom,
          ayahTo: details.ayahTo,
          contentType: file.type,
          sizeBytes: file.size,
          rightsConfirmed: true,
        },
      });
      await putWithProgress(presign.uploadUrl, file, presign.headers, (f) =>
        setPhase({ step: 'uploading', pct: Math.round(f * 100), confirming: false }),
      );
      setPhase({ step: 'uploading', pct: 100, confirming: true });
      const created = await api.createRecitation({
        body: {
          uploadToken: presign.uploadToken,
          title: details.title,
          style: details.style,
          riwayah: details.riwayah,
          durationSec,
        },
      });
      setPhase({ step: 'done', status: created.status });
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      setError(
        code === 'UNSUPPORTED_MEDIA_TYPE'
          ? t('errorType')
          : code === 'FILE_TOO_LARGE'
            ? t('errorSize')
            : code === 'QUOTA_EXCEEDED'
              ? t('errorQuota')
              : code === 'INVALID_AYAH_RANGE'
                ? t('errorRange')
                : t('errorGeneric'),
      );
      setPhase({ step: 'rights' });
    }
  };

  const reset = () => {
    form.reset();
    setFile(null);
    setRights(false);
    setDetails(null);
    setPhase({ step: 'details' });
  };

  return (
    <div>
      <ol className="mb-8 grid grid-cols-4 gap-2" aria-label={t('title')}>
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === stepIndex ? 'step' : undefined} className="space-y-1.5">
            <span
              className={cn('block h-1 rounded-full', i <= stepIndex ? 'bg-primary' : 'bg-border')}
            />
            <span
              className={cn(
                'block text-xs',
                i === stepIndex ? 'font-medium text-text' : 'text-muted',
              )}
            >
              {t(s)}
            </span>
          </li>
        ))}
      </ol>

      {phase.step === 'details' ? (
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) =>
            void form.handleSubmit((values) => {
              setDetails(values);
              setPhase({ step: 'file' });
            })(e)
          }
        >
          <Field id="surah" label={t('surah')}>
            <Select id="surah" {...form.register('surah')}>
              {surahs.map((s) => (
                <option key={s.number} value={s.number}>
                  {s.number}. {s.nameTransliterated} — {s.nameArabic}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field id="ayahFrom" label={t('from')}>
              <Input
                id="ayahFrom"
                type="number"
                min={1}
                max={selectedSurah?.ayahCount}
                {...form.register('ayahFrom')}
              />
            </Field>
            <Field
              id="ayahTo"
              label={t('to')}
              error={form.formState.errors.ayahTo ? t('errorRange') : undefined}
            >
              <Input
                id="ayahTo"
                type="number"
                min={1}
                max={selectedSurah?.ayahCount}
                {...form.register('ayahTo')}
                aria-invalid={Boolean(form.formState.errors.ayahTo)}
              />
            </Field>
          </div>
          <Field
            id="title"
            label={t('titleLabel')}
            hint={t('titleHint')}
            error={form.formState.errors.title ? t('titleHint') : undefined}
          >
            <Input
              id="title"
              {...form.register('title')}
              aria-invalid={Boolean(form.formState.errors.title)}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="style" label={t('style')}>
              <Select id="style" {...form.register('style')}>
                {RecitationStyle.options.map((s) => (
                  <option key={s} value={s}>
                    {styles(s)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="riwayah" label={t('riwayah')}>
              <Select id="riwayah" {...form.register('riwayah')}>
                {Riwayah.options.map((r) => (
                  <option key={r} value={r}>
                    {riwayat(r)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit">{t('next')}</Button>
          </div>
        </form>
      ) : null}

      {phase.step === 'file' ? (
        <div className="space-y-4">
          <label
            htmlFor="audio-file"
            className="flex cursor-pointer flex-col items-center rounded-card border border-dashed border-muted/60 bg-surface px-6 py-10 text-center hover:bg-surface-raised"
          >
            <FileAudio aria-hidden className="mb-3 size-8 text-primary" />
            <span className="font-medium text-text">{file ? file.name : t('chooseFile')}</span>
            <span className="mt-1 text-xs text-muted">{t('fileHint')}</span>
            <input
              id="audio-file"
              type="file"
              accept={AudioContentType.options.join(',')}
              className="sr-only"
              onChange={(e) => chooseFile(e.target.files?.[0])}
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setPhase({ step: 'details' })}>
              {t('step1')}
            </Button>
            <Button disabled={!file} onClick={() => setPhase({ step: 'rights' })}>
              {t('next')}
            </Button>
          </div>
        </div>
      ) : null}

      {phase.step === 'rights' ? (
        <div className="space-y-6">
          <label className="flex items-start gap-3 rounded-card border border-border bg-surface p-4 text-text">
            <input
              type="checkbox"
              checked={rights}
              onChange={(e) => setRights(e.target.checked)}
              className="mt-1 size-4 accent-primary"
            />
            <span>{t('rights')}</span>
          </label>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setPhase({ step: 'file' })}>
              {t('step2')}
            </Button>
            <Button disabled={!rights} onClick={() => void upload()}>
              {t('start')}
            </Button>
          </div>
        </div>
      ) : null}

      {phase.step === 'uploading' ? (
        <div
          role="status"
          aria-live="polite"
          className="space-y-3 rounded-card border border-border bg-surface p-6"
        >
          <p className="font-medium text-text">
            {phase.confirming ? t('confirming') : t('uploading', { pct: phase.pct })}
          </p>
          <div
            className="h-2 overflow-hidden rounded-full bg-border"
            role="progressbar"
            aria-valuenow={phase.pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full bg-primary transition-[width] duration-300 ease-mushaf"
              style={{ width: `${String(phase.pct)}%` }}
            />
          </div>
        </div>
      ) : null}

      {phase.step === 'done' ? (
        <div role="status" className="rounded-card border border-border bg-surface p-8 text-center">
          <CheckCircle2 aria-hidden className="mx-auto mb-3 size-10 text-success" />
          <h2 className="font-display text-2xl text-text">
            {phase.status === 'approved' ? t('approvedTitle') : t('pendingTitle')}
          </h2>
          {phase.status !== 'approved' ? (
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{t('pendingBody')}</p>
          ) : null}
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="secondary" onClick={reset}>
              {t('another')}
            </Button>
            <Button asChild>
              <Link href="/studio">{t('goStudio')}</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
