import type { ReactNode } from 'react';
import { Card } from '@/components/ui/misc';
import { StarMark } from '@/components/ui/ornaments';

export function AuthShell({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Card className="p-8">
        <StarMark className="mb-4 size-9 text-accent" />
        <h1 className="font-display text-3xl text-text">{title}</h1>
        {body ? <p className="mt-2 text-sm text-muted">{body}</p> : null}
        <div className="mt-6">{children}</div>
      </Card>
    </div>
  );
}
