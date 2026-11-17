import { mushafNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';

/** Eight-point star outline, the motif behind the ayah marker, logo and empty states. */
export function StarMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="10" y="10" width="28" height="28" rx="1.5" />
      <rect x="10" y="10" width="28" height="28" rx="1.5" transform="rotate(45 24 24)" />
      <circle cx="24" cy="24" r="6.5" />
    </svg>
  );
}

/** The eight-point star without its centre, to frame a number. */
export function StarFrame({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="9" y="9" width="30" height="30" rx="2" />
      <rect x="9" y="9" width="30" height="30" rx="2" transform="rotate(45 24 24)" />
    </svg>
  );
}

/** Ayah number in a small brass rosette, as in a printed mushaf. */
export function AyahMarker({
  n,
  label,
  className,
}: {
  n: number;
  label: string;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        'relative mx-1 inline-flex size-[1.15em] items-center justify-center align-middle text-accent',
        className,
      )}
    >
      <StarMark className="absolute inset-0 size-full" />
      <span
        className="relative font-sans text-[0.36em] leading-none font-semibold text-text"
        aria-hidden
      >
        {mushafNumber(n)}
      </span>
    </span>
  );
}

/** Girih (eight-point star) lattice for the surah header only, at 5% opacity. */
export function GirihPattern({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 size-full text-primary opacity-[0.05]',
        className,
      )}
    >
      <defs>
        <pattern id="girih" width="64" height="64" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="1.2">
            <rect x="16" y="16" width="32" height="32" />
            <rect x="16" y="16" width="32" height="32" transform="rotate(45 32 32)" />
            <path d="M0 32h16M48 32h16M32 0v16M32 48v16" />
            <circle cx="32" cy="32" r="7" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#girih)" />
    </svg>
  );
}
