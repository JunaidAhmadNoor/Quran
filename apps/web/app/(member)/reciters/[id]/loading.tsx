import { Skeleton } from '@/components/ui/misc';

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10" aria-busy="true">
      <Skeleton className="mb-8 h-56 w-full rounded-card" />
      <Skeleton className="mb-6 h-9 w-48" />
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="mb-2 h-16 w-full" />
      ))}
    </div>
  );
}
