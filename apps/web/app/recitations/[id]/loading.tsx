import { Skeleton } from '@/components/ui/misc';

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10" aria-busy="true">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-2 mb-8 h-10 w-2/3" />
      <div className="flex gap-6 rounded-card border border-border bg-surface p-6">
        <Skeleton className="size-40 shrink-0" />
        <div className="flex-1 space-y-4">
          <Skeleton className="h-[72px] w-full" />
          <Skeleton className="h-12 w-40 rounded-full" />
        </div>
      </div>
    </div>
  );
}
