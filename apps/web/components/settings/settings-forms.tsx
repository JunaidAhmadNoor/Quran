'use client';
import { UpdateMeBody } from '@tilawah/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type SyntheticEvent } from 'react';
import { toast } from 'sonner';
import { ModeSwitch } from '@/components/layout/mode-switch';
import { LanguageMenu, ThemeMenu } from '@/components/layout/preferences';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Card } from '@/components/ui/misc';
import type { Me } from '@/hooks/use-me';
import { ApiError, api } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import { formText } from '@/lib/utils';

type ProfileBody = Parameters<typeof api.updateMe>[0]['body'];

export function SettingsForms({ me }: { me: Me }) {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const tn = useTranslations('nav');
  const tm = useTranslations('mode');
  const qc = useQueryClient();
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmText, setConfirmText] = useState('');

  const save = useMutation({
    mutationFn: (body: ProfileBody) => api.updateMe({ body }),
    onSuccess: (account) => {
      qc.setQueryData(['me'], account);
      toast.success(t('saved'));
    },
  });

  const onSave = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const country = formText(data, 'country').trim().toUpperCase();
    const bio = formText(data, 'bio');
    const body = {
      name: formText(data, 'name'),
      bio: bio === '' ? null : bio,
      country: country === '' ? null : country,
    };
    const parsed = UpdateMeBody.safeParse(body); // same schema as the API
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), tc('required')])),
      );
      return;
    }
    setErrors({});
    save.mutate(body);
  };

  const remove = useMutation({
    mutationFn: () => api.deleteMe(),
    onSuccess: async () => {
      await authClient.signOut().catch(() => undefined);
      qc.setQueryData(['me'], null);
      router.push('/');
      router.refresh();
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError && error.code === 'REAUTH_REQUIRED' ? t('reauth') : tc('retry'),
      ),
  });

  return (
    <div className="space-y-8">
      <Card className="p-6">
        <h2 className="mb-4 font-display text-xl text-text">{t('profile')}</h2>
        <form onSubmit={onSave} className="space-y-4">
          <Field id="name" label={t('name')} error={errors.name}>
            <Input id="name" name="name" defaultValue={me.name} maxLength={80} required />
          </Field>
          <Field id="bio" label={t('bio')} error={errors.bio}>
            <Textarea id="bio" name="bio" defaultValue={me.bio ?? ''} maxLength={500} />
          </Field>
          <Field id="country" label={t('country')} hint={t('countryHint')} error={errors.country}>
            <Input
              id="country"
              name="country"
              defaultValue={me.country ?? ''}
              maxLength={2}
              className="w-24 uppercase"
            />
          </Field>
          <p className="text-sm text-muted">
            {t('email')}: {me.email}
          </p>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? tc('saving') : tc('save')}
          </Button>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 font-display text-xl text-text">{t('appearance')}</h2>
        <div className="flex flex-wrap items-center gap-6 text-sm text-text">
          <span className="flex items-center gap-2">
            {tn('language')} <LanguageMenu />
          </span>
          <span className="flex items-center gap-2">
            {tn('theme')} <ThemeMenu />
          </span>
          <span className="flex items-center gap-2">
            {tm('label')} <ModeSwitch redirect={false} />
          </span>
        </div>
      </Card>

      <Card className="border-danger/40 p-6">
        <h2 className="font-display text-xl text-text">{t('deleteTitle')}</h2>
        <p className="mt-2 text-sm text-muted">{t('deleteBody')}</p>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="danger" className="mt-4">
              {t('deleteButton')}
            </Button>
          </DialogTrigger>
          <DialogContent
            title={t('deleteTitle')}
            description={t('deleteBody')}
            closeLabel={tc('close')}
          >
            <Field id="confirm-delete" label={t('deleteConfirm')}>
              <Input
                id="confirm-delete"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
              />
            </Field>
            <Button
              variant="danger"
              className="mt-4 w-full"
              disabled={confirmText !== 'DELETE' || remove.isPending}
              onClick={() => remove.mutate()}
            >
              {t('deleteButton')}
            </Button>
          </DialogContent>
        </Dialog>
      </Card>
    </div>
  );
}
