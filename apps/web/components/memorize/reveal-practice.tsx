'use client';
import { AnimatePresence, m } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AyahMarker } from '@/components/ui/ornaments';

interface Props {
  ayahs: { number: number; words: { position: number; text: string }[] }[];
}

/**
 * Hidden-word layout used by memorization. In Phase 3 words are revealed by hand; Phase 4 drives
 * the same component from speech recognition. Placeholders keep each word's width, so the line
 * never jumps when a word appears.
 */
export function RevealPractice({ ayahs }: Props) {
  const t = useTranslations('memorize');
  const ts = useTranslations('surah');
  const total = ayahs.reduce((n, a) => n + a.words.length, 0);
  const [revealed, setRevealed] = useState(0);
  let index = 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          onClick={() => setRevealed((r) => Math.min(total, r + 1))}
          disabled={revealed >= total}
        >
          {t('revealNext')}
        </Button>
        <Button variant="secondary" onClick={() => setRevealed(total)}>
          {t('revealAll')}
        </Button>
        <Button variant="ghost" onClick={() => setRevealed(0)}>
          {t('hideAll')}
        </Button>
      </div>
      <div
        lang="ar"
        dir="rtl"
        className="rounded-card border border-border bg-surface px-5 py-8 sm:px-10"
      >
        <p className="quran text-text">
          {ayahs.map((a) => (
            <span key={a.number}>
              {a.words.map((w) => {
                const shown = index++ < revealed;
                return (
                  <span key={w.position} className="relative me-[0.25em] inline-block">
                    {/* The word is always laid out (invisible when hidden) so its width is reserved. */}
                    <AnimatePresence initial={false}>
                      {shown ? (
                        <m.span
                          initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }}
                          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                          transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                          className="inline-block"
                        >
                          {w.text}
                        </m.span>
                      ) : (
                        <span className="relative inline-block">
                          <span className="invisible">{w.text}</span>
                          <span
                            aria-label={t('hiddenWord')}
                            role="img"
                            className="absolute inset-x-0 top-1/2 h-[0.9em] -translate-y-1/2 rounded-full bg-surface-raised"
                          />
                        </span>
                      )}
                    </AnimatePresence>
                  </span>
                );
              })}
              <AyahMarker n={a.number} label={ts('ayahMarker', { n: a.number })} />{' '}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}
