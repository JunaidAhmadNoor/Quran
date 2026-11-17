'use client';
// Studio: switch one recitation between private (only the uploader) and public (reviewed first,
// unless the reciter is verified).
import type { RecitationStatus } from '@tilawah/contracts';
import { Globe, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ApiError, api } from '@/lib/api';

export function VisibilityToggle({ id, status }: { id: string; status: RecitationStatus }) {
  const t = useTranslations('studio');
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (status === 'rejected' || status === 'removed') return null;
  const makePublic = status === 'private';

  const change = async () => {
    setBusy(true);
    try {
      const updated = await api.updateRecitation({
        params: { id },
        body: { visibility: makePublic ? 'public' : 'private' },
      });
      toast.success(
        updated.status === 'private'
          ? t('madePrivate')
          : updated.status === 'approved'
            ? t('madePublished')
            : t('madePending'),
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size="sm" variant="secondary" disabled={busy} onClick={() => void change()}>
      {makePublic ? <Globe aria-hidden /> : <Lock aria-hidden />}
      {makePublic ? t('makePublic') : t('makePrivate')}
    </Button>
  );
}
