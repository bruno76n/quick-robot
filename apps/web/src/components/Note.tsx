import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Icon } from './Icon';

/** Soft note box (mockup .note). */
export function Note({ tone = 'plain', children, className }: { tone?: 'plain' | 'ok' | 'warn' | 'bad'; children: ReactNode; className?: string }) {
  const tones = { plain: 'bg-panel text-ink-2', ok: 'bg-green-soft text-green-ink', warn: 'bg-amber-soft text-amber-ink', bad: 'bg-red-soft text-red-ink' };
  return <div className={cn('rounded-card px-[14px] py-[11px] text-[13.5px]', tones[tone], className)}>{children}</div>;
}

/** Status line with a colored left rule (mockup .status). */
export function StatusLine({ tone, children }: { tone: 'good' | 'warn' | 'bad' | 'info'; children: ReactNode }) {
  const c = { good: 'var(--green)', warn: 'var(--amber)', bad: 'var(--red)', info: 'var(--ink-3)' }[tone];
  return (
    <p className={cn('flex items-start gap-2 rounded-r-[5px] border-l-[3px] px-3 py-[9px] text-[14px]', tone === 'bad' ? 'bg-red-soft text-red-ink' : 'bg-panel text-ink')} style={{ borderLeftColor: c }}>
      <span className="mt-[2px]" style={{ color: c }}>
        <Icon name={tone === 'good' ? 'check' : 'warn'} size={16} />
      </span>
      <span>{children}</span>
    </p>
  );
}
