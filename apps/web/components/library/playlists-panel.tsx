'use client';
import type { Playlist } from '@tilawah/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ListMusic, Plus } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState, type SyntheticEvent } from 'react';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/states';
import { api } from '@/lib/api';
import { formText } from '@/lib/utils';

type PlaylistItem = z.output<typeof Playlist>;

export function PlaylistsPanel({ initial }: { initial: PlaylistItem[] }) {
  const t = useTranslations('library');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const list = useQuery({
    queryKey: ['playlists-library'],
    queryFn: async () => (await api.getLibrary({ query: { limit: 1 } })).playlists,
    initialData: initial,
  });
  const create = useMutation({
    mutationFn: (body: { name: string; isPublic: boolean }) => api.createPlaylist({ body }),
    onSuccess: () => {
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ['playlists-library'] });
      void qc.invalidateQueries({ queryKey: ['playlists'] });
    },
  });
  const onSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = formText(data, 'name').trim();
    if (name) create.mutate({ name, isPublic: data.get('public') === 'on' });
  };

  return (
    <section aria-labelledby="playlists" id="playlists">
      <div className="mb-4 flex items-end justify-between">
        <h2 id="playlists" className="font-display text-2xl text-text">
          {t('playlists')}
        </h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="secondary">
              <Plus />
              {t('newPlaylist')}
            </Button>
          </DialogTrigger>
          <DialogContent title={t('newPlaylist')} closeLabel={tc('close')}>
            <form onSubmit={onSubmit} className="space-y-4">
              <Field id="playlist-name" label={t('playlistName')}>
                <Input id="playlist-name" name="name" required maxLength={80} />
              </Field>
              <label className="flex items-start gap-2 text-sm text-text">
                <input type="checkbox" name="public" className="mt-0.5 accent-primary" />
                <span>
                  {t('public')}
                  <span className="block text-xs text-muted">{t('publicHint')}</span>
                </span>
              </label>
              <div className="flex justify-end">
                <Button type="submit" disabled={create.isPending}>
                  {t('create')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {list.data.length === 0 ? (
        <EmptyState title={t('emptyPlaylists')} />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {list.data.map((p) => (
            <li key={p.id}>
              <Link
                href={`/playlists/${p.id}`}
                className="flex items-center gap-3 rounded-card border border-border bg-surface p-4 hover:bg-surface-raised"
              >
                <ListMusic aria-hidden className="size-6 text-primary" />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-text">{p.name}</span>
                  <span className="text-xs text-muted">
                    {t('items', { count: p.recitationCount })} · {p.isPublic ? t('public') : null}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
