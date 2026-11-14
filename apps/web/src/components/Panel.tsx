import type { ReactNode } from 'react';

/**
 * Panel (ronda-3 §3, mockup .ui-panel/.ui-ph): white, 1 px --line border, radius 12, no shadow.
 * - title: the panel title (h2, 14 px semibold), left. aside: its action or short data, right (a Button, a <Count>,
 *   a <span className="meta">). Without title and aside there is no header.
 * - flush: less vertical padding, for a panel that only holds a table.
 * - className, id, aria-label: passed to the <section>.
 */
export function Panel({ title, aside, children, flush, className = '', id, 'aria-label': ariaLabel }: {
  title?: ReactNode; aside?: ReactNode; children?: ReactNode; flush?: boolean; className?: string; id?: string; 'aria-label'?: string;
}) {
  return (
    <section className={['panel', flush && 'flush', className].filter(Boolean).join(' ')} id={id} aria-label={ariaLabel}>
      {title !== undefined || aside !== undefined ? (
        <header className="panel-h">{title !== undefined ? <h2>{title}</h2> : <span />}{aside !== undefined ? <div className="panel-a">{aside}</div> : null}</header>
      ) : null}
      {children}
    </section>
  );
}

/** Small counter next to a panel title or a menu item (mockup .ui-count): dark by default, light grey with `light`. */
export function Count({ n, light }: { n: number; light?: boolean }) {
  return <span className={`count num${light ? ' lt' : ''}`}>{n}</span>;
}
