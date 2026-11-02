import type { ReactNode } from 'react';

export type Tone = 'plain' | 'info' | 'good' | 'warn' | 'bad' | '';
/** Chip with a colored dot (docs/07 Pill/Chip). */
export function Pill({ tone = '', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`chip ${tone}`}>{children}</span>;
}

export function Swatch({ hex, large }: { hex: string; large?: boolean }) {
  return <span className={`sw${large ? ' lg' : ''}`} style={{ ['--c' as string]: hex }} />;
}
