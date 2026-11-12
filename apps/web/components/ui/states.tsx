import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { StarMark } from './ornaments';

/** Designed empty state: star motif, one sentence, one action. */
export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-card border border-dashed border-border px-6 py-10 text-center',
        className,
      )}
    >
      <StarMark className="mb-3 size-10 text-accent" />
      <p className="font-display text-lg text-text">{title}</p>
      {body ? <p className="mt-1 max-w-sm text-sm text-muted">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center"
    >
      <StarMark className="mb-4 size-12 text-danger" />
      <h1 className="font-display text-2xl text-text">{title}</h1>
      <p className="mt-2 text-muted">{body}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
