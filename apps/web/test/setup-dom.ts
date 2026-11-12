import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './msw';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => server.close());

// jsdom lacks ResizeObserver, which Radix's slider uses.
class ResizeObserverStub {
  observe(): void {
    // no-op: layout is not measured in jsdom
  }
  unobserve(): void {
    // no-op
  }
  disconnect(): void {
    // no-op
  }
}
if (!('ResizeObserver' in globalThis))
  Object.assign(globalThis, { ResizeObserver: ResizeObserverStub });
