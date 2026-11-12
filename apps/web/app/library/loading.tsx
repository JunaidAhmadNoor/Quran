import { Skeleton } from '@/components/ui/misc';

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-10" aria-busy="true">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-7 w-56" />
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
