'use client';
import { Heart } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/use-me';
import { ApiError, api } from '@/lib/api';
import { cn } from '@/lib/utils';

/** Optimistic like: the heart fills at once and rolls back if the request fails. */
export function LikeButton({
  id,
  liked: initialLiked,
  count: initialCount,
  showCount = false,
}: {
  id: string;
  liked: boolean;
  count: number;
  showCount?: boolean;
}) {
  const t = useTranslations('common');
  const tr = useTranslations('recitation');
  const { data: me } = useMe();
  const router = useRouter();
  const [state, setState] = useState({ liked: initialLiked, count: initialCount });

  const mutation = useMutation({
    mutationFn: (like: boolean) =>
      like ? api.likeRecitation({ params: { id } }) : api.unlikeRecitation({ params: { id } }),
    onMutate: (like) => {
      const previous = state;
      setState({ liked: like, count: Math.max(0, previous.count + (like ? 1 : -1)) });
      return previous;
    },
    onError: (error, _like, previous) => {
      if (previous) setState(previous);
      toast.error(
        error instanceof ApiError && error.status === 401 ? tr('signInToLike') : t('retry'),
      );
    },
    onSuccess: (res) => setState({ liked: res.liked, count: res.likeCount }),
  });

  return (
    <Button
      variant="ghost"
      size={showCount ? 'sm' : 'icon-sm'}
      aria-pressed={state.liked}
      // With a visible count the name must contain it (WCAG 2.5.3), so the label is sr-only text.
      aria-label={showCount ? undefined : state.liked ? t('unlike') : t('like')}
      onClick={() => {
        if (!me) {
          toast(tr('signInToLike'));
          router.push('/auth/sign-in');
          return;
        }
        mutation.mutate(!state.liked);
      }}
      className={cn(state.liked ? 'text-danger' : 'text-muted')}
    >
      <Heart fill={state.liked ? 'currentColor' : 'none'} />
      {showCount ? (
        <>
          <span className="sr-only">{state.liked ? t('unlike') : t('like')}</span>
          <span className="tabular-nums">{state.count}</span>
        </>
      ) : null}
    </Button>
  );
}
