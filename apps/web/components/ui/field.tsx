import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';

// Form controls use text-muted for their border (5:1 contrast), not the decorative border token.
const control =
  'w-full rounded-control border border-muted/60 bg-surface px-3 text-text placeholder:text-muted/80 focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-0 aria-[invalid=true]:border-danger';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, 'h-10', className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, 'min-h-24 py-2', className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control, 'h-10 pe-8', className)} {...props} />;
}

interface FieldProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | undefined;
  children: ReactNode;
  className?: string;
}

/** Label, control, hint and error, wired together for screen readers. */
export function Field({ id, label, hint, error, children, className }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-text">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
