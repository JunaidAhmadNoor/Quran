'use client';
import '@/lib/zod-config';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LazyMotion, MotionConfig, domMax } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { AudioProvider } from '@/components/player/audio-provider';
import type { Me } from '@/hooks/use-me';

export function Providers({
  children,
  initialMe,
  dir,
}: {
  children: ReactNode;
  initialMe: Me | null;
  dir: 'ltr' | 'rtl';
}) {
  const [client] = useState(() => {
    const qc = new QueryClient({
      defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
    });
    qc.setQueryData(['me'], initialMe);
    return qc;
  });
  return (
    <QueryClientProvider client={client}>
      {/* reducedMotion="user": movement becomes plain opacity changes when the OS asks for it. */}
      <MotionConfig reducedMotion="user" transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}>
        <LazyMotion features={domMax} strict>
          {children}
          <AudioProvider />
          <Toaster
            dir={dir}
            position="top-center"
            toastOptions={{
              className: '!rounded-card !border !border-border !bg-surface !text-text !shadow-sm',
            }}
          />
        </LazyMotion>
      </MotionConfig>
    </QueryClientProvider>
  );
}
