import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from './Icon';

type Variant = 'default' | 'primary' | 'green' | 'ghost' | 'link';
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  icon?: string;
  block?: boolean;
  danger?: boolean;
  busy?: boolean;
  busyLabel?: string;
  children?: ReactNode;
}

/** Writes disable the button while the request runs ("Guardando…", docs/07). */
export function Button({ variant = 'default', size = 'md', icon, block, danger, busy, busyLabel, className = '', children, disabled, type = 'button', ...rest }: ButtonProps) {
  const cls = variant === 'link' ? 'link' : ['btn', variant !== 'default' && variant, size === 'sm' && 'sm', block && 'block', danger && 'danger', className].filter(Boolean).join(' ');
  return (
    <button type={type} className={cls} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
      {icon ? <Icon name={icon} size={16} /> : null}
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
}
