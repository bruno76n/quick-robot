import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';

/**
 * Table (ronda-3 §3, mockup .ui-tbl): grey 11.5 px headers, light row separators, 13 px rows.
 * - head: the header cells (use <Th>); children: the rows (<tr> with <Td>).
 * - small: compact rows and no minimum width (inside drawers and dialogs).
 * - fit: normal rows but no 640 px minimum width (a table that fits a phone with its .hide-sm columns hidden).
 * Rows with className="click" highlight on hover; "sel" marks the open one.
 */
export function Table({ head, children, className = '', small, fit }: { head: ReactNode; children: ReactNode; className?: string; small?: boolean; fit?: boolean }) {
  return (
    <div className="tw">
      <table className={`tbl${small ? ' sm' : ''}${fit ? ' fit' : ''} ${className}`}>
        <thead><tr>{head}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

type CellOpts = { /** number column: right aligned */ r?: boolean; /** hidden on a phone (≤ 760 px) */ hideSm?: boolean };
const cellClass = (r: boolean | undefined, hideSm: boolean | undefined, className: string | undefined) => [r && 'r', hideSm && 'hide-sm', className].filter(Boolean).join(' ') || undefined;

/** Header cell: <Th r hideSm>Ganancia</Th>. */
export function Th({ r, hideSm, className, ...rest }: CellOpts & ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cellClass(r, hideSm, className)} {...rest} />;
}
/** Body cell: <Td r hideSm className="num">$120</Td>. */
export function Td({ r, hideSm, className, ...rest }: CellOpts & TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cellClass(r, hideSm, className)} {...rest} />;
}
