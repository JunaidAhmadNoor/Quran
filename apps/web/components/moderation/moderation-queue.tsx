'use client';
import type { ModerationQueueResponse } from '@tilawah/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Play, X } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/field';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/states';
import { api } from '@/lib/api';
import { toTrack, usePlayer } from '@/lib/player-store';
import { formatDuration } from '@/lib/utils';

type Queue = z.output<typeof ModerationQueueResponse>;
type Decision = { id: string; decision: 'reject' | 'remove' } | null;

export function ModerationQueue({ initial }: { initial: Queue }) {
  const t = useTranslations('moderation');
  const tc = useTranslations('common');
  const reasons = useTranslations('reportReasons');
  const qc = useQueryClient();
  const [decision, setDecision] = useState<Decision>(null);
  const [reason, setReason] = useState('');

  const uploads = useQuery({
    queryKey: ['mod', 'recitations'],
    queryFn: () => api.getModerationQueue({ query: { kind: 'recitations' } }),
    initialData: initial,
  });
  const reports = useQuery({
    queryKey: ['mod', 'reports'],
    queryFn: () => api.getModerationQueue({ query: { kind: 'reports' } }),
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['mod'] });

  const decide = useMutation({
    mutationFn: (input: {
      id: string;
      body: { decision: 'approve' } | { decision: 'reject' | 'remove'; reason: string };
    }) => api.decideRecitation({ params: { id: input.id }, body: input.body }),
    onSuccess: (r) => {
      toast.success(
        r.status === 'approved'
          ? t('approved')
          : r.status === 'rejected'
            ? t('rejected')
            : t('removed'),
      );
      setDecision(null);
      setReason('');
      refresh();
    },
  });
  const closeReport = useMutation({
    mutationFn: (input: { id: string; decision: 'actioned' | 'dismissed' }) =>
      api.decideReport({ params: { id: input.id }, body: { decision: input.decision } }),
    onSuccess: () => {
      toast.success(t('closed'));
      refresh();
    },
  });

  const counts = uploads.data.counts;
  const pending = uploads.data.kind === 'recitations' ? uploads.data.items : [];
  const open = reports.data?.kind === 'reports' ? reports.data.items : [];

  return (
    <>
      <Tabs defaultValue="uploads">
        <TabsList>
          <TabsTrigger value="uploads">
            {t('uploads')} ({counts.pendingRecitations})
          </TabsTrigger>
          <TabsTrigger value="reports">
            {t('reports')} ({counts.openReports})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="uploads" className="pt-6">
          {pending.length === 0 ? (
            <EmptyState title={t('emptyUploads')} />
          ) : (
            <ul className="space-y-3">
              {pending.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface p-4"
                >
                  <Button
                    variant="secondary"
                    size="icon"
                    className="rounded-full"
                    aria-label={`${tc('play')}: ${r.title}`}
                    onClick={() => usePlayer.getState().playQueue([toTrack(r)])}
                  >
                    <Play />
                  </Button>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/recitations/${r.id}`}
                      className="block truncate font-medium text-text hover:underline"
                    >
                      {r.title}
                    </Link>
                    <p className="text-sm text-muted">
                      {r.reciter.name} · {toTrack(r).surahNameEnglish}{' '}
                      {tc('ayahRange', { from: r.ayahFrom, to: r.ayahTo })} ·{' '}
                      {formatDuration(r.durationSec)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => decide.mutate({ id: r.id, body: { decision: 'approve' } })}
                      disabled={decide.isPending}
                    >
                      <Check />
                      {t('approve')}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setDecision({ id: r.id, decision: 'reject' })}
                    >
                      <X />
                      {t('reject')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
        <TabsContent value="reports" className="pt-6">
          {open.length === 0 ? (
            <EmptyState title={t('emptyReports')} />
          ) : (
            <ul className="space-y-3">
              {open.map((report) => (
                <li key={report.id} className="rounded-card border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-text">{reasons(report.reason)}</p>
                      {report.note ? (
                        <p className="mt-1 text-sm text-text">“{report.note}”</p>
                      ) : null}
                      <p className="mt-1 text-sm text-muted">
                        <Link
                          href={`/recitations/${report.recitation.id}`}
                          className="hover:underline"
                        >
                          {report.recitation.title}
                        </Link>{' '}
                        · {t('reportedBy', { name: report.reporter.name })}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => closeReport.mutate({ id: report.id, decision: 'dismissed' })}
                      >
                        {t('dismiss')}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() =>
                          setDecision({ id: report.recitation.id, decision: 'remove' })
                        }
                      >
                        {t('remove')}
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={decision !== null}
        onOpenChange={(o) => {
          if (!o) setDecision(null);
        }}
      >
        <DialogContent
          title={decision?.decision === 'remove' ? t('remove') : t('reject')}
          closeLabel={tc('close')}
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (decision && reason.trim().length >= 3)
                decide.mutate({
                  id: decision.id,
                  body: { decision: decision.decision, reason: reason.trim() },
                });
            }}
          >
            <Field id="mod-reason" label={t('reason')}>
              <Textarea
                id="mod-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                minLength={3}
                maxLength={500}
              />
            </Field>
            <div className="flex justify-end">
              <Button
                type="submit"
                variant="danger"
                disabled={reason.trim().length < 3 || decide.isPending}
              >
                {decision?.decision === 'remove' ? t('remove') : t('reject')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
