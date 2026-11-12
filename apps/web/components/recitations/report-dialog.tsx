'use client';
import { CreateReportBody, ReportReason } from '@tilawah/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { Flag } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/field';
import { useMe } from '@/hooks/use-me';
import { ApiError, api } from '@/lib/api';

type Values = z.input<typeof CreateReportBody>;

/** Same schema as the API (packages/contracts), so the form and server agree. */
export function ReportDialog({ id }: { id: string }) {
  const t = useTranslations('recitation');
  const tc = useTranslations('common');
  const reasons = useTranslations('reportReasons');
  const { data: me } = useMe();
  // The list menu links here with #report to open the dialog straight away.
  const [open, setOpen] = useState(
    () => typeof window !== 'undefined' && window.location.hash === '#report',
  );
  const form = useForm<Values>({
    resolver: zodResolver(CreateReportBody),
    defaultValues: { reason: 'wrong_surah', note: '' },
  });

  const submit = form.handleSubmit(async (values) => {
    try {
      await api.reportRecitation({
        params: { id },
        body: { reason: values.reason, ...(values.note ? { note: values.note } : {}) },
      });
      toast.success(t('reportSent'));
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof ApiError && error.code === 'ALREADY_REPORTED'
          ? t('alreadyReported')
          : tc('retry'),
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted">
          <Flag />
          {tc('report')}
        </Button>
      </DialogTrigger>
      <DialogContent title={t('reportTitle')} closeLabel={tc('close')}>
        {me ? (
          <form onSubmit={(e) => void submit(e)} className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium text-text">{t('reportReason')}</legend>
              {ReportReason.options.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm text-text">
                  <input
                    type="radio"
                    value={r}
                    {...form.register('reason')}
                    className="accent-primary"
                  />
                  {reasons(r)}
                </label>
              ))}
            </fieldset>
            <Field
              id="report-note"
              label={t('reportNote')}
              hint={t('reportNoteHint')}
              error={form.formState.errors.note?.message}
            >
              <Textarea
                id="report-note"
                {...form.register('note')}
                aria-invalid={Boolean(form.formState.errors.note)}
              />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {t('reportSend')}
              </Button>
            </div>
          </form>
        ) : (
          <Button asChild>
            <Link href="/auth/sign-in">{t('signInToReport')}</Link>
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
