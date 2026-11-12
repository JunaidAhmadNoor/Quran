'use client';
import * as Menu from '@radix-ui/react-dropdown-menu';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;
export const DropdownMenuLabel = ({ className, ...p }: ComponentProps<typeof Menu.Label>) => (
  <Menu.Label className={cn('px-2 py-1.5 text-xs font-medium text-muted', className)} {...p} />
);
export const DropdownMenuSeparator = () => <Menu.Separator className="my-1 h-px bg-border" />;

export function DropdownMenuContent({ className, ...props }: ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        sideOffset={6}
        className={cn(
          'z-50 min-w-48 rounded-card border border-border bg-surface p-1 text-text shadow-sm',
          className,
        )}
        {...props}
      />
    </Menu.Portal>
  );
}

export function DropdownMenuItem({ className, ...props }: ComponentProps<typeof Menu.Item>) {
  return (
    <Menu.Item
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-control px-2 py-2 text-sm outline-none select-none data-[highlighted]:bg-surface-raised data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted',
        className,
      )}
      {...props}
    />
  );
}

export const DropdownMenuRadioGroup = Menu.RadioGroup;
export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: ComponentProps<typeof Menu.RadioItem>) {
  return (
    <Menu.RadioItem
      className={cn(
        'flex cursor-pointer items-center justify-between gap-4 rounded-control px-2 py-2 text-sm outline-none data-[highlighted]:bg-surface-raised data-[state=checked]:font-medium data-[state=checked]:text-primary',
        className,
      )}
      {...props}
    >
      {children}
      <Menu.ItemIndicator aria-hidden>•</Menu.ItemIndicator>
    </Menu.RadioItem>
  );
}
