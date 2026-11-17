import { BadgeCheck } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-control bg-surface-raised', className)}
      {...props}
    />
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-card border border-border bg-surface', className)} {...props} />
  );
}

/** Brass badge for verified reciters (brass is used for small decorative marks only). */
export function VerifiedBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center text-accent', className)} title={label}>
      <BadgeCheck aria-hidden className="size-4" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

const STATUS_STYLE = {
  private: 'border-accent/60 text-text',
  pending: 'border-muted/40 text-muted',
  approved: 'border-success/50 text-success',
  rejected: 'border-danger/50 text-danger',
  removed: 'border-muted/40 text-muted line-through',
} as const;

export function StatusBadge({
  status,
  children,
}: {
  status: keyof typeof STATUS_STYLE;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-control border bg-surface px-2 py-0.5 text-xs font-medium',
        STATUS_STYLE[status],
      )}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  children,
  action,
  id,
}: {
  children: ReactNode;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 id={id} className="font-display text-2xl text-text">
        {children}
      </h2>
      {action}
    </div>
  );
}
