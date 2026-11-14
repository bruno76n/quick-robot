import type { ReactNode } from 'react';
import { Icon } from './Icon';

export interface Step {
  key: string;
  label: ReactNode;
  /** Date under the step; only when the system stores it (D-1: Aceptado has none). */
  date?: ReactNode;
}

/**
 * Steps of an order (ronda-3 §3, mockup .ui-steps): a dot per state; done in ink with a check, the current one with
 * a ring, the pending ones grey. The date shows only when it comes.
 * - current: index of the current step (-1: none; steps.length: all done).
 * - label: accessible name of the list.
 */
export function Steps({ steps, current, label }: { steps: readonly Step[]; current: number; label?: string }) {
  return (
    <ol className="steps" aria-label={label} style={{ gridTemplateColumns: `repeat(${Math.max(1, steps.length)}, minmax(0, 1fr))` }}>
      {steps.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'cur' : undefined;
        return (
          <li key={s.key} className={state} aria-current={state === 'cur' ? 'step' : undefined}>
            <span className="dot">{state === 'done' ? <Icon name="check" size={13} /> : null}</span>
            <b>{s.label}</b>
            {s.date !== undefined && s.date !== null && s.date !== '' ? <small>{s.date}</small> : null}
          </li>
        );
      })}
    </ol>
  );
}
