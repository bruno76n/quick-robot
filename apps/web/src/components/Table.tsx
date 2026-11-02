import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

/** Wide list table (mockup .tbl / .tw). `small` = compact variant used inside drawers. */
export function Table({ small, children, className }: { small?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className="relative overflow-x-auto">
      <table className={cn('w-full border-collapse', small ? 'text-[14px]' : 'min-w-[640px]', className)} data-small={small ? '' : undefined}>
        {children}
      </table>
    </div>
  );
}

export function Th({ align, className, ...rest }: ThHTMLAttributes<HTMLTableCellElement> & { align?: 'right' }) {
  return <th className={cn('whitespace-nowrap border-b border-line-2 px-[10px] py-2 text-left text-[12.5px] font-medium text-ink-2', align === 'right' && 'text-right', className)} {...rest} />;
}

export function Td({ align, small, className, ...rest }: TdHTMLAttributes<HTMLTableCellElement> & { align?: 'right'; small?: boolean }) {
  return <td className={cn('border-b border-line align-middle', small ? 'px-[10px] py-[7px]' : 'px-[10px] py-3', align === 'right' && 'text-right', className)} {...rest} />;
}

/** Clickable row with hover/selected state (purple left mark). */
export function Tr({ selected, onActivate, className, children, ...rest }: HTMLAttributes<HTMLTableRowElement> & { selected?: boolean; onActivate?: () => void }) {
  return (
    <tr
      tabIndex={onActivate ? 0 : undefined}
      aria-selected={onActivate ? !!selected : undefined}
      onClick={onActivate}
      onKeyDown={onActivate ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onActivate()) : undefined}
      className={cn(
        onActivate && 'cursor-pointer [&:hover>td]:bg-panel [&:focus-visible>td]:bg-panel [&:hover>td:first-child]:shadow-[inset_3px_0_0_var(--purple)] focus-visible:outline-none',
        selected && '[&>td]:bg-panel',
        className,
      )}
      {...rest}
    >
      {children}
    </tr>
  );
}
