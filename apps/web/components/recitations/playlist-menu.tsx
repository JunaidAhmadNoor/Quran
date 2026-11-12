'use client';
import { ListPlus, Flag, MoreHorizontal } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/menu';
import { useMe } from '@/hooks/use-me';
import { api } from '@/lib/api';

export function RecitationMenu({ id }: { id: string }) {
  const t = useTranslations('library');
  const tc = useTranslations('common');
  const { data: me } = useMe();
  const playlists = useQuery({
    queryKey: ['playlists'],
    queryFn: () => api.listPlaylists({ query: { limit: 50 } }),
    enabled: Boolean(me),
  });
  const add = useMutation({
    mutationFn: async (playlistId: string) => {
      const detail = await api.getPlaylist({ params: { id: playlistId } });
      const ids = detail.recitations.map((r) => r.id);
      if (!ids.includes(id))
        await api.updatePlaylist({
          params: { id: playlistId },
          body: { recitationIds: [...ids, id] },
        });
      return detail.name;
    },
    onSuccess: (name) => toast.success(t('addedTo', { name })),
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={tc('more')} className="text-muted">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {me ? (
          <>
            <DropdownMenuLabel>{t('addToPlaylist')}</DropdownMenuLabel>
            {(playlists.data?.items ?? []).map((p) => (
              <DropdownMenuItem key={p.id} onSelect={() => add.mutate(p.id)}>
                <ListPlus />
                {p.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem asChild>
              <Link href="/library#playlists">
                <ListPlus />
                {t('newPlaylist')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem asChild>
          <Link href={`/recitations/${id}#report`}>
            <Flag />
            {tc('report')}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
