'use client';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

interface ContentProps extends Omit<ComponentProps<typeof DialogPrimitive.Content>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  closeLabel: string;
}

export function DialogContent({
  title,
  description,
  closeLabel,
  className,
  children,
  ...props
}: ContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-text/40 data-[state=open]:animate-in" />
      <DialogPrimitive.Content
        className={cn(
          'fixed start-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-card border border-border bg-surface p-6 shadow-sm rtl:translate-x-1/2',
          className,
        )}
        {...props}
      >
        <div className="mb-4 space-y-1 pe-8">
          <DialogPrimitive.Title className="font-display text-xl text-text">
            {title}
          </DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="text-sm text-muted">
              {description}
            </DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
          )}
        </div>
        {children}
        <DialogPrimitive.Close
          className="absolute end-3 top-3 rounded-control p-2 text-muted hover:bg-surface-raised hover:text-text"
          aria-label={closeLabel}
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
