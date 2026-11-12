import { StarMark } from '@/components/ui/ornaments';
import { cn } from '@/lib/utils';

/** "Cover art" for a recitation: the surah name in Quran script on ink green, a brass star. */
export function SurahCover({ nameArabic, className }: { nameArabic: string; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'relative flex aspect-square items-center justify-center overflow-hidden rounded-control bg-primary text-primary-contrast',
        className,
      )}
    >
      <StarMark className="absolute -end-[18%] -top-[18%] size-[60%] text-accent opacity-60" />
      <span
        lang="ar"
        dir="rtl"
        className="relative px-1 text-center font-quran leading-tight"
        style={{ fontSize: 'clamp(0.7rem, 28cqw, 3.5rem)' }}
      >
        {nameArabic}
      </span>
    </div>
  );
}
