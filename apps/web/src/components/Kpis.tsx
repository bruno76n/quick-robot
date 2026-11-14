import type { ReactNode } from 'react';

export interface Kpi {
  /** Short label above the figure ("Ganancia bruta"). */
  label: ReactNode;
  /** The figure, already formatted ("$5,077"). */
  value: ReactNode;
  /** Small line under the figure ("▲ 17.6%", "13 ventas"). */
  sub?: ReactNode;
  /**
   * '' plain · 'net' the figure is profit (green) · 'bad' the figure is a debt or a failure (red) ·
   * 'up' / 'down' color only the sub line (green / red).
   */
  tone?: '' | 'net' | 'bad' | 'up' | 'down';
}

/**
 * Figures of the period (ronda-3 §3, mockup .kps-row): one strip of 3 to 5 figures with dividers, not loose cards;
 * 2 × 2 on a phone (the fifth takes the whole row).
 * - inline: the strip sits inside a panel (top border only, mockup .kps), instead of being its own white panel.
 * - label: accessible name of the list.
 */
export function Kpis({ items, inline, label, className = '' }: { items: readonly Kpi[]; inline?: boolean; label?: string; className?: string }) {
  return (
    <dl className={['kps', `n${items.length}`, inline ? 'inline' : 'row', className].filter(Boolean).join(' ')} aria-label={label}>
      {items.map((k, i) => (
        <div key={i} className={`kp${k.tone ? ` ${k.tone}` : ''}`}>
          <dt>{k.label}</dt>
          <dd className="num">{k.value}{k.sub !== undefined ? <small>{k.sub}</small> : null}</dd>
        </div>
      ))}
    </dl>
  );
}
