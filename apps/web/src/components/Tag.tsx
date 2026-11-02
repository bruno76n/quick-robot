import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

/** Toggle / filter pill (mockup .tag). */
export function Tag({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn('cursor-pointer rounded-pill border-0 px-[14px] py-[5px] text-[13.5px]', on ? 'bg-ink font-semibold text-bg' : 'bg-panel font-medium text-ink-2 hover:text-ink')}
    >
      {children}
    </button>
  );
}

export function TagRow({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cn('flex flex-wrap gap-[6px]', className)}>
      {children}
    </div>
  );
}
