import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

/** Label + control + optional help or error (mockup .fld). */
export function Field({ label, help, error, children, className, htmlFor }: { label: ReactNode; help?: ReactNode; error?: ReactNode; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={cn('grid min-w-0 content-start gap-1', className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-ink-2">
        {label}
      </label>
      {children}
      {error ? (
        <small className="leading-[1.3] text-red-ink" role="alert">
          {error}
        </small>
      ) : help ? (
        <small className="leading-[1.3]">{help}</small>
      ) : null}
    </div>
  );
}
