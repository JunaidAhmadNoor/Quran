'use client';
import { Pause, Play } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';

/** Play/pause icon that morphs (scale + fade, 150 ms). */
export function PlayPauseIcon({ playing, className }: { playing: boolean; className?: string }) {
  return (
    <AnimatePresence initial={false} mode="popLayout">
      <m.span
        key={playing ? 'pause' : 'play'}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.6 }}
        transition={{ duration: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
        className="inline-flex"
      >
        {playing ? (
          <Pause className={className} fill="currentColor" />
        ) : (
          <Play className={className} fill="currentColor" />
        )}
      </m.span>
    </AnimatePresence>
  );
}
