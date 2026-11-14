import type { ReactNode } from 'react';

export type Tone = 'plain' | 'info' | 'good' | 'ok' | 'warn' | 'bad' | '';
/**
 * State pill (ronda-3 §3, mockup .ui-pill): 22 px, radius 6, a dot of the color before the text.
 * The text always says the state; the color only reinforces it.
 * - tone: '' / 'plain' grey · 'good' or 'ok' green (correct, available) · 'warn' amber (low, soon) · 'bad' red
 *   (critical, overdue, failed) · 'info' light grey with dark ink.
 */
export function Pill({ tone = '', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`chip ${tone === 'ok' ? 'good' : tone}`}>{children}</span>;
}

/** The real color of a filament (data, not interface color). */
export function Swatch({ hex, large }: { hex: string; large?: boolean }) {
  return <span className={`sw${large ? ' lg' : ''}`} style={{ ['--c' as string]: hex }} />;
}
