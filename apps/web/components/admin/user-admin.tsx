'use client';
// Admin: find an account by email, then verify it as a reciter or change its role.
import type { Role } from '@tilawah/contracts';
import { BadgeCheck, MailCheck, MailWarning, Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Card } from '@/components/ui/misc';
import type { Me } from '@/hooks/use-me';
import { ApiError, api } from '@/lib/api';

const ROLES = ['user', 'moderator', 'admin'] as const satisfies readonly Role[];
const ROLE_LABEL = { user: 'roleUser', moderator: 'roleModerator', admin: 'roleAdmin' } as const;

export function UserAdmin({ selfId }: { selfId: string }) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const [email, setEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [user, setUser] = useState<Me | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [draft, setDraft] = useState<{ role: Role; verifiedReciter: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const find = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    setSearching(true);
    setNotFound(false);
    try {
      const { items } = await api.findUsers({ query: { email: email.trim() } });
      const found = items[0] ?? null;
      setUser(found);
      setDraft(found ? { role: found.role, verifiedReciter: found.verifiedReciter } : null);
      setNotFound(!found);
    } catch {
      toast.error(t('error'));
    } finally {
      setSearching(false);
    }
  };

  const save = async () => {
    if (!user || !draft) return;
    const body = {
      ...(draft.role !== user.role ? { role: draft.role } : {}),
      ...(draft.verifiedReciter !== user.verifiedReciter
        ? { verifiedReciter: draft.verifiedReciter }
        : {}),
    };
    if (Object.keys(body).length === 0) return;
    setSaving(true);
    try {
      const updated = await api.updateUser({ params: { id: user.id }, body });
      setUser(updated);
      setDraft({ role: updated.role, verifiedReciter: updated.verifiedReciter });
      toast.success(t('saved'));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('error'));
    } finally {
      setSaving(false);
    }
  };

  const isSelf = user?.id === selfId;
  const changed =
    user && draft && (draft.role !== user.role || draft.verifiedReciter !== user.verifiedReciter);
  const joined = user
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(user.createdAt))
    : '';

  return (
    <div className="space-y-6">
      <form onSubmit={(e) => void find(e)} className="flex items-end gap-2" noValidate>
        <Field id="find-email" label={t('searchLabel')} className="flex-1">
          <Input
            id="find-email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Button type="submit" disabled={searching}>
          <Search />
          {t('search')}
        </Button>
      </form>

      {notFound ? (
        <p role="status" className="text-sm text-muted">
          {t('notFound')}
        </p>
      ) : null}

      {user && draft ? (
        <Card className="space-y-6 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-1 font-display text-xl text-text">
                {user.name}
                {user.verifiedReciter ? (
                  <BadgeCheck aria-hidden className="size-5 text-accent" />
                ) : null}
              </p>
              <p className="text-sm text-muted">{user.email}</p>
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                <span className="inline-flex items-center gap-1">
                  {user.emailVerified ? (
                    <MailCheck aria-hidden className="size-3.5 text-success" />
                  ) : (
                    <MailWarning aria-hidden className="size-3.5 text-danger" />
                  )}
                  {t(user.emailVerified ? 'emailVerified' : 'emailNotVerified')}
                </span>
                <span>{t(user.mode === 'reciter' ? 'modeReciter' : 'modeListener')}</span>
                <span>{t('joined', { date: joined })}</span>
              </p>
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={draft.verifiedReciter}
              onChange={(e) => setDraft({ ...draft, verifiedReciter: e.target.checked })}
              className="mt-1 size-4 accent-[var(--primary)]"
            />
            <span>
              <span className="block font-medium text-text">{t('verified')}</span>
              <span className="block text-sm text-muted">{t('verifiedHint')}</span>
            </span>
          </label>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-text">
              {t('role')}
            </label>
            <select
              id="role"
              value={draft.role}
              disabled={isSelf}
              onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}
              className="mt-1 h-10 w-full max-w-xs rounded-control border border-muted bg-surface px-3 text-text disabled:opacity-60"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(ROLE_LABEL[r])}
                </option>
              ))}
            </select>
            {isSelf ? <p className="mt-1 text-xs text-muted">{t('selfRole')}</p> : null}
          </div>

          <Button onClick={() => void save()} disabled={!changed || saving}>
            {t('save')}
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
