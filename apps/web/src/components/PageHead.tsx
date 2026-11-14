// Head of every screen (ronda-3 §3 "Encabezado de pantalla", reference/ronda-3 .ui-top): breadcrumb on detail
// screens, title (26 px, 24 on tablet, 22 on phone), a short data line under it and the actions on the right
// (the main one is <Button variant="primary">, in ink). It also names the screen in the top bar of tablet and phone.
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { es } from '../i18n/es';
import { go } from '../lib/nav';

export interface Crumb { label: string; to?: string }

/** The frame (AppShell) listens to the title of the screen on show to put it in the top bar (≤ 1099 px). */
export const ScreenTitle = createContext<(title: string | null) => void>(() => undefined);

/**
 * - title: text, or a node (then pass `short` for the top bar).
 * - sub: the short data line under the title (one line: folio · customer, counts…).
 * - crumbs: parent screens of a detail, e.g. [{ label: 'Pedidos', to: '/pedidos' }]; each one ends in «/».
 * - actions: buttons, the main one last and `variant="primary"`.
 * - short: the screen name in the top bar when the title is not plain text.
 */
export function PageHead({ title, sub, actions, crumbs, short }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; crumbs?: readonly Crumb[]; short?: string }) {
  const setTitle = useContext(ScreenTitle);
  const name = short ?? (typeof title === 'string' ? title : null);
  useEffect(() => { setTitle(name); return () => setTitle(null); }, [name, setTitle]);
  return (
    <header className="ph">
      {crumbs?.length ? (
        <nav className="crumbs" aria-label={es.common.breadcrumb}>
          {crumbs.map((c) => (
            <span key={c.label} className="crumb">
              {c.to ? <a href={c.to} onClick={(e) => { e.preventDefault(); go(c.to!); }}>{c.label}</a> : <span>{c.label}</span>}
              <span className="sep" aria-hidden="true">/</span>
            </span>
          ))}
        </nav>
      ) : null}
      <div className="ph-t"><h1>{title}</h1>{sub ? <p className="sub">{sub}</p> : null}</div>
      {actions ? <div className="ph-a">{actions}</div> : null}
    </header>
  );
}
