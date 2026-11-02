import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export type Tone = 'good' | 'warn' | 'bad' | 'info' | 'plain';

const tones: Record<Tone, { box: string; dot: string }> = {
  good: { box: 'bg-panel-2 text-ink-2', dot: 'bg-green' },
  warn: { box: 'bg-amber-soft text-amber-ink', dot: 'bg-amber' },
  bad: { box: 'bg-red-soft text-red-ink', dot: 'bg-red' },
  info: { box: 'bg-panel-2 text-ink-2', dot: 'bg-[#8b8b97]' },
  plain: { box: 'bg-panel-2 text-ink-2', dot: 'bg-ink-3' },
};

/** Status chip with a colored dot (mockup .chip). */
export function Pill({ tone = 'plain', children }: { tone?: Tone; children: ReactNode }) {
  const t = tones[tone];
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-pill px-[10px] py-[2px] text-[12.5px] font-semibold leading-[18.125px]', t.box)}>
      <span aria-hidden="true" className={cn('mr-[6px] inline-block size-[6px] rounded-full', t.dot)} />
      {children}
    </span>
  );
}
