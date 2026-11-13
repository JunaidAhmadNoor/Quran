import { Skeleton } from '@/components/ui/misc';

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10" aria-busy="true">
      <Skeleton className="mb-6 h-10 w-40" />
      <Skeleton className="mb-6 h-10 w-full max-w-xl" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton key={i} className="h-[74px] rounded-card" />
        ))}
      </div>
    </div>
  );
}
