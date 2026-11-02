import type { ReactNode } from 'react';

/** Wide table with header; rows are passed as children (docs/07 Table). */
export function Table({ head, children, className = '', small }: { head: ReactNode; children: ReactNode; className?: string; small?: boolean }) {
  return (
    <div className="tw">
      <table className={`tbl${small ? ' sm' : ''} ${className}`}>
        <thead><tr>{head}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
