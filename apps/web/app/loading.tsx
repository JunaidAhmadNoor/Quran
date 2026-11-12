import { Skeleton } from '@/components/ui/misc';

/** Shaped like the home page: hero, then two lists and a side column. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10" aria-busy="true">
      <Skeleton className="h-12 w-3/4 max-w-xl" />
      <Skeleton className="mt-4 h-5 w-2/3 max-w-lg" />
      <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-3">
          <Skeleton className="h-7 w-48" />
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
        <Skeleton className="h-56 w-full rounded-card" />
      </div>
    </div>
  );
}
