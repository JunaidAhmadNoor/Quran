'use client';
import type { AccountMode } from '@tilawah/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useMe } from '@/hooks/use-me';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

/** Fiverr-style Listener | Reciter switch. No sign-out: the next request already sees the mode. */
/**
 * `redirect` (default): go to the studio or home after switching, like Fiverr's seller/buyer switch.
 * Pages where switching is part of the task (upload, studio, settings) stay put and refresh.
 */
export function ModeSwitch({
  className,
  redirect = true,
}: {
  className?: string;
  redirect?: boolean;
}) {
  const t = useTranslations('mode');
  const tc = useTranslations('common');
  const { data: me } = useMe();
  const qc = useQueryClient();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  const mutation = useMutation({
    mutationFn: (mode: AccountMode) => api.switchMode({ body: { mode } }),
    onSuccess: (account) => {
      qc.setQueryData(['me'], account);
      toast.success(t('switched', { mode: t(account.mode) }));
      if (redirect) router.push(account.mode === 'reciter' ? '/studio' : '/');
      router.refresh();
    },
  });

  if (!me) return null;
  const choose = (mode: AccountMode) => {
    if (mode === me.mode || mutation.isPending) return;
    if (mode === 'reciter' && !me.reciterSince) setConfirming(true);
    else mutation.mutate(mode);
  };

  return (
    <>
      <div
        role="radiogroup"
        aria-label={t('label')}
        className={cn(
          'inline-flex rounded-control border border-border bg-surface p-0.5',
          className,
        )}
      >
        {(['listener', 'reciter'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={me.mode === mode}
            onClick={() => choose(mode)}
            className={cn(
              'rounded-[4px] px-3 py-1 text-xs font-medium transition-colors duration-150',
              me.mode === mode ? 'bg-primary text-primary-contrast' : 'text-muted hover:text-text',
            )}
          >
            {t(mode)}
          </button>
        ))}
      </div>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent
          title={t('firstTitle')}
          description={t('firstBody')}
          closeLabel={tc('close')}
        >
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              {tc('cancel')}
            </Button>
            <Button
              onClick={() => {
                setConfirming(false);
                mutation.mutate('reciter');
              }}
            >
              {t('confirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
