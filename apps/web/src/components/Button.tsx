import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from './Icon';

type Variant = 'default' | 'primary' | 'green' | 'ghost' | 'link';
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  icon?: string | undefined;
  block?: boolean;
  danger?: boolean;
  busy?: boolean;
  busyLabel?: string;
  children?: ReactNode;
}

/**
 * Button (ronda-3 §2): 30 px high, radius 7.
 * - variant: 'default' white with a line · 'primary' ink (the main action of a screen or dialog) · 'green' same look
 *   as primary (green is only for profit) · 'ghost' no border · 'link' text link.
 * - size: 'md' 30 px · 'sm' 26 px. icon: name from Icon.tsx. block: full width. danger: red text.
 * Writes disable the button while the request runs ("Guardando…", docs/07): busy + busyLabel.
 */
export function Button({ variant = 'default', size = 'md', icon, block, danger, busy, busyLabel, className = '', children, disabled, type = 'button', ...rest }: ButtonProps) {
  const cls = variant === 'link' ? 'link' : ['btn', variant !== 'default' && variant, size === 'sm' && 'sm', block && 'block', danger && 'danger', className].filter(Boolean).join(' ');
  return (
    <button type={type} className={cls} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
      {icon ? <Icon name={icon} size={16} /> : null}
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
}
