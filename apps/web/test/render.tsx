import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { LazyMotion, MotionConfig, domMax } from 'motion/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import messages from '@/messages/en.json';
import type { Me } from '@/hooks/use-me';

/** Renders with the same providers as the app (query client, Motion, English messages). */
export function renderWithProviders(ui: ReactElement, { me = null }: { me?: Me | null } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['me'], me);
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <MotionConfig reducedMotion="always">
          <LazyMotion features={domMax} strict>
            {ui}
          </LazyMotion>
        </MotionConfig>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

export const demoMe: Me = {
  id: '665f1c2e9b1d4a0012ab34cd',
  name: 'Amina',
  email: 'amina@example.com',
  emailVerified: true,
  image: null,
  role: 'user',
  mode: 'reciter',
  reciterSince: '2026-11-12T08:00:00.000Z',
  verifiedReciter: false,
  bio: null,
  country: null,
  createdAt: '2026-11-12T08:00:00.000Z',
};
