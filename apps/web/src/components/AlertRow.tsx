import type { ReactNode } from 'react';
import { Icon } from './Icon';

/** List of alerts (mockup .al-list); its children are <AlertRow>. */
export function AlertList({ children, label }: { children: ReactNode; label?: string }) {
  return <ul className="al-list" aria-label={label}>{children}</ul>;
}

/**
 * One alert (ronda-3 §3, mockup .al-list li): icon in a square of the state's color, title, detail and the button of
 * the action on the right (hidden on a phone only if the row itself is the link; pass it anyway).
 * - tone: 'bad' red · 'warn' amber · '' grey. icon: name from Icon.tsx.
 * - action: a Button or a link to the place where the alert is solved.
 */
export function AlertRow({ tone = '', icon, title, detail, action }: { tone?: '' | 'warn' | 'bad'; icon: string; title: ReactNode; detail?: ReactNode; action?: ReactNode }) {
  return (
    <li className="al">
      <span className={`al-ic${tone ? ` ${tone}` : ''}`}><Icon name={icon} size={16} /></span>
      <span className="al-t"><b>{title}</b>{detail !== undefined ? <span>{detail}</span> : null}</span>
      {action ?? <span />}
    </li>
  );
}
