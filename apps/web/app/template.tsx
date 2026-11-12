import type { ReactNode } from 'react';

/** Page transitions: a 150 ms fade only (CSS, so it never hides server-rendered content). */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="animate-page">{children}</div>;
}
