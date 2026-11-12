'use client';
import * as SliderPrimitive from '@radix-ui/react-slider';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Slider({
  className,
  'aria-label': label,
  ...props
}: ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      className={cn('relative flex h-5 w-full touch-none items-center select-none', className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1 grow overflow-hidden rounded-full bg-border">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={label}
        className="block size-3.5 rounded-full border-2 border-primary bg-surface transition-transform duration-150 hover:scale-110"
      />
    </SliderPrimitive.Root>
  );
}
