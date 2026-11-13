'use client';
// Admin: every account with its key data, search and role filter, and a dialog to grant the
// verified-reciter badge or change the role.
import type { AdminUserPage, Role } from '@tilawah/contracts';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, MailCheck, MailWarning, Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useDeferredValue, useState } from 'react';
import { toast } from 'sonner';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/field';
import { ApiError, api } from '@/lib/api';
import { cn } from '@/lib/utils';

type Page = z.output<typeof AdminUserPage>;
type AdminUser = Page['items'][number];

const ROLES = ['user', 'moderator', 'admin'] as const satisfies readonly Role[];
const ROLE_LABEL = { user: 'roleUser', moderator: 'roleModerator', admin: 'roleAdmin' } as const;
const ROLE_STYLE = {
  user: 'border-border text-muted',
  moderator: 'border-primary/40 text-primary',
  admin: 'border-accent/60 text-text',
} as const;

export function UserAdmin({ selfId, initial }: { selfId: string; initial: Page }) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const [text, setText] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const q = useDeferredValue(text.trim());
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const filtered = q !== '' || role !== '';

  const query = useInfiniteQuery({
    queryKey: ['admin-users', q, role],
    queryFn: ({ pageParam }) =>
      api.listUsers({
        query: { q: q || undefined, role: role || undefined, cursor: pageParam, limit: 25 },
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    // The server-rendered first page, so the table appears instantly.
    ...(filtered ? {} : { initialData: { pages: [initial], pageParams: [undefined] } }),
    staleTime: 30_000,
  });
  const users = query.data?.pages.flatMap((p) => p.items) ?? [];
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const nf = new Intl.NumberFormat(locale);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted"
          />
          <Input
            type="search"
            aria-label={t('searchPlaceholder')}
            placeholder={t('searchPlaceholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="ps-9"
          />
        </div>
        <select
          aria-label={t('role')}
          value={role}
          onChange={(e) => setRole(e.target.value as Role | '')}
          className="h-10 rounded-control border border-muted bg-surface px-3 text-text"
        >
          <option value="">{t('filterAll')}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {t(ROLE_LABEL[r])}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-card border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="hidden border-b border-border bg-surface-raised text-start text-xs text-muted md:table-header-group">
            <tr>
              <th className="px-4 py-3 text-start font-medium">{t('colAccount')}</th>
              <th className="px-4 py-3 text-start font-medium">{t('colRole')}</th>
              <th className="px-4 py-3 text-start font-medium">{t('colStatus')}</th>
              <th className="px-4 py-3 text-start font-medium">{t('colRecitations')}</th>
              <th className="px-4 py-3 text-start font-medium">{t('colJoined')}</th>
              <th className="px-4 py-3">
                <span className="sr-only">{t('manage')}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id} className="flex flex-col gap-2 p-4 md:table-row md:p-0">
                <td className="md:px-4 md:py-3">
                  <span className="flex items-center gap-1 font-medium text-text">
                    {u.name}
                    {u.verifiedReciter ? (
                      <BadgeCheck aria-label={t('verified')} className="size-4 text-accent" />
                    ) : null}
                  </span>
                  <span className="block text-xs break-all text-muted">{u.email}</span>
                </td>
                <td className="md:px-4 md:py-3">
                  <span
                    className={cn(
                      'inline-flex rounded-control border px-2 py-0.5 text-xs font-medium',
                      ROLE_STYLE[u.role],
                    )}
                  >
                    {t(ROLE_LABEL[u.role])}
                  </span>
                </td>
                <td className="text-xs text-muted md:px-4 md:py-3">
                  <span className="flex items-center gap-1">
                    {u.emailVerified ? (
                      <MailCheck aria-hidden className="size-3.5 text-success" />
                    ) : (
                      <MailWarning aria-hidden className="size-3.5 text-danger" />
                    )}
                    {t(u.emailVerified ? 'emailVerified' : 'emailNotVerified')}
                  </span>
                  <span className="block">
                    {t(u.mode === 'reciter' ? 'modeReciter' : 'modeListener')}
                  </span>
                </td>
                <td className="text-xs text-muted md:px-4 md:py-3">
                  {t('recitationCounts', {
                    approved: nf.format(u.recitations.approved),
                    pending: nf.format(u.recitations.pending),
                  })}
                </td>
                <td className="text-xs whitespace-nowrap text-muted md:px-4 md:py-3">
                  {date.format(new Date(u.createdAt))}
                </td>
                <td className="md:px-4 md:py-3 md:text-end">
                  <Button size="sm" variant="secondary" onClick={() => setEditing(u)}>
                    {t('manage')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && !query.isFetching ? (
          <p role="status" className="p-6 text-center text-sm text-muted">
            {t('empty')}
          </p>
        ) : null}
      </div>

      {query.hasNextPage ? (
        <div className="text-center">
          <Button
            variant="secondary"
            onClick={() => void query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            {t('loadMore')}
          </Button>
        </div>
      ) : null}

      <ManageDialog user={editing} selfId={selfId} onClose={() => setEditing(null)} />
    </div>
  );
}

function ManageDialog({
  user,
  selfId,
  onClose,
}: {
  user: AdminUser | null;
  selfId: string;
  onClose: () => void;
}) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const [draft, setDraft] = useState<{ role: Role; verifiedReciter: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  // Reset the form whenever a different account is opened.
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  if (user && openedFor !== user.id) {
    setOpenedFor(user.id);
    setDraft({ role: user.role, verifiedReciter: user.verifiedReciter });
  }

  const isSelf = user?.id === selfId;
  const changed =
    user && draft && (draft.role !== user.role || draft.verifiedReciter !== user.verifiedReciter);

  const save = async () => {
    if (!user || !draft || !changed) return;
    setSaving(true);
    try {
      await api.updateUser({
        params: { id: user.id },
        body: {
          ...(draft.role !== user.role ? { role: draft.role } : {}),
          ...(draft.verifiedReciter !== user.verifiedReciter
            ? { verifiedReciter: draft.verifiedReciter }
            : {}),
        },
      });
      await qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(t('saved'));
      onClose();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={user !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent title={t('manageTitle')} closeLabel={tc('close')}>
        {user && draft ? (
          <div className="space-y-6">
            <div>
              <p className="font-medium text-text">{user.name}</p>
              <p className="text-sm break-all text-muted">{user.email}</p>
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
              <label htmlFor="manage-role" className="block text-sm font-medium text-text">
                {t('role')}
              </label>
              <select
                id="manage-role"
                value={draft.role}
                disabled={isSelf}
                onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}
                className="mt-1 h-10 w-full rounded-control border border-muted bg-surface px-3 text-text disabled:opacity-60"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t(ROLE_LABEL[r])}
                  </option>
                ))}
              </select>
              {isSelf ? <p className="mt-1 text-xs text-muted">{t('selfRole')}</p> : null}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                {tc('cancel')}
              </Button>
              <Button onClick={() => void save()} disabled={!changed || saving}>
                {t('save')}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
