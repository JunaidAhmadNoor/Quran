import { Mic } from 'lucide-react';
import { AyahMarker, GirihPattern } from '@/components/ui/ornaments';

interface Props {
  title: string;
  listening: string;
  caption: string;
  /** Quran words (from quran-data, never edited), grouped by ayah. */
  ayahs: { number: number; words: string[] }[];
}

/**
 * A still picture of the practice screen that plays once on load: placeholders fade away word by
 * word as if recited. Pure CSS, server-rendered; with reduced motion every word is simply shown.
 */
export function MemorizeDemo({ title, listening, caption, ayahs }: Props) {
  let i = 0;
  const total = ayahs.reduce((n, a) => n + a.words.length, 0);
  // The last two words stay hidden, so the picture reads as "in progress".
  const revealed = total - 2;
  return (
    <figure className="relative overflow-hidden rounded-card border border-border bg-surface p-6 shadow-sm sm:p-8">
      <GirihPattern className="opacity-[0.06]" />
      <div className="relative flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-text">{title}</span>
        <span className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1 text-primary-contrast">
          <span aria-hidden className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary-contrast/70 motion-reduce:hidden" />
            <span className="relative inline-flex size-2 rounded-full bg-primary-contrast" />
          </span>
          <Mic aria-hidden className="size-3.5" />
          {listening}
        </span>
      </div>
      <p lang="ar" dir="rtl" aria-hidden className="quran relative mt-6 text-text">
        {ayahs.map((a) => (
          <span key={a.number}>
            {a.words.map((w) => {
              const index = i++;
              const shown = index < revealed;
              return (
                <span key={index} className="relative me-[0.25em] inline-block">
                  <span
                    className={
                      shown ? 'animate-[word-in_260ms_var(--ease-mushaf)_both]' : 'invisible'
                    }
                    style={shown ? { animationDelay: `${String(600 + index * 380)}ms` } : undefined}
                  >
                    {w}
                  </span>
                  <span
                    className={
                      shown
                        ? 'absolute inset-x-0 top-1/2 h-[0.9em] -translate-y-1/2 rounded-full bg-surface-raised animate-[demo-hide_260ms_ease-out_both] motion-reduce:hidden'
                        : 'absolute inset-x-0 top-1/2 h-[0.9em] -translate-y-1/2 rounded-full bg-surface-raised'
                    }
                    style={shown ? { animationDelay: `${String(600 + index * 380)}ms` } : undefined}
                  />
                </span>
              );
            })}
            <AyahMarker n={a.number} label="" />{' '}
          </span>
        ))}
      </p>
      <figcaption className="relative mt-6 flex items-center gap-3 text-sm text-muted">
        <span aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
          <span
            className="block h-full origin-left bg-primary animate-[demo-progress_var(--demo-ms)_linear_both] rtl:origin-right"
            style={
              {
                '--demo-ms': `${String(600 + revealed * 380)}ms`,
                transform: `scaleX(${String(revealed / total)})`,
              } as React.CSSProperties
            }
          />
        </span>
        {caption}
      </figcaption>
    </figure>
  );
}
