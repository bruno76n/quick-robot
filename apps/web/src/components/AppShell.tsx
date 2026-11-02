// Sidebar, top bar on small screens and the work area (docs/06 §1). Business name and trade come from
// the workspace (Ajustes), never from code (D30).
import { Link, useRouterState } from '@tanstack/react-router';
import { useEffect, useState, type ReactNode } from 'react';
import { es } from '../i18n/es';
import { Icon } from './Icon';
import { Mascot } from './Mascot';

export interface NavItem { to: string; label: string; icon: string }
export const NAV: readonly (readonly [string | null, readonly NavItem[]])[] = [
  [null, [{ to: '/inicio', label: es.nav.home, icon: 'home' }]],
  [es.nav.groupSell, [{ to: '/productos', label: es.nav.products, icon: 'box' }, { to: '/ventas', label: es.nav.sales, icon: 'coin' }, { to: '/pedidos', label: es.nav.orders, icon: 'list' }]],
  [es.nav.groupWorkshop, [
    { to: '/filamentos', label: es.nav.filaments, icon: 'spool' }, { to: '/insumos', label: es.nav.supplies, icon: 'nut' }, { to: '/impresoras', label: es.nav.printers, icon: 'printer' },
    { to: '/produccion', label: es.nav.production, icon: 'layers' }, { to: '/existencias', label: es.nav.stock, icon: 'store' }, { to: '/compras', label: es.nav.purchases, icon: 'cart' }]],
  [es.nav.groupBusiness, [{ to: '/clientes', label: es.nav.customers, icon: 'users' }, { to: '/gastos', label: es.nav.expenses, icon: 'wallet' }, { to: '/reportes', label: es.nav.reports, icon: 'chart' }, { to: '/ajustes', label: es.nav.settings, icon: 'gear' }]],
];

export function AppShell({ businessName, trade, banner, onNewPiece, onSearch, children }: { businessName: string; trade: string; banner?: ReactNode; onNewPiece?: () => void; onSearch?: () => void; children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  // The menu closes by itself when the route changes: it is open only for the path where it was opened.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const navOpen = openAt === path;
  const setNavOpen = (v: boolean) => setOpenAt(v ? path : null);
  useEffect(() => { document.body.classList.toggle('nav-open', navOpen); }, [navOpen]);
  // Split screens scroll each side on its own (mockup: .pn-s, .pn-e, .pn-p on #main).
  useEffect(() => {
    const view = document.getElementById('view');
    const main = document.getElementById('main');
    if (!view || !main) return;
    const mark = () => {
      main.classList.toggle('pn-s', Boolean(view.querySelector(':scope > .split')));
      main.classList.toggle('pn-e', Boolean(view.querySelector(':scope > .ed')));
      main.classList.toggle('pn-p', Boolean(view.querySelector(':scope > .cols2.pd')));
    };
    mark();
    const obs = new MutationObserver(mark);
    obs.observe(view, { childList: true });
    return () => obs.disconnect();
  }, []);
  const section = `/${path.split('/')[1] ?? ''}`;
  return (
    <div className="app" id="app">
      <header className="topbar">
        <button type="button" className="btn ghost icon" onClick={() => setNavOpen(true)} aria-label={es.common.openMenu}><Icon name="menu" size={20} /></button>
        <span className="t-name"><span className="mk"><Mascot size={28} /></span>{businessName}</span>
        <button type="button" className="btn green sm" onClick={onNewPiece} disabled={!onNewPiece}>{es.nav.newPiece}</button>
      </header>
      <aside className="side" id="side" aria-label={es.common.mainMenu}>
        <div className="brand"><span className="mk"><Mascot size={40} /></span><div><b>{businessName}</b>{trade ? <small>{trade}</small> : null}</div></div>
        <button type="button" className="btn green block" onClick={onNewPiece} disabled={!onNewPiece}><Icon name="plus" size={16} />{es.nav.newPiece}</button>
        <button type="button" className="srch" onClick={onSearch} aria-label={es.common.searchAll}><Icon name="search" size={16} /><span>{es.common.search}</span><kbd>{es.common.searchShortcut}</kbd></button>
        <nav className="nav" aria-label={es.common.screens}>
          {NAV.map(([group, items]) => (
            <div className="ng" key={group ?? 'top'}>
              {group ? <span className="ngl">{group}</span> : null}
              {items.map((it) => (
                <Link key={it.to} to={it.to} aria-current={section === it.to ? 'page' : undefined}><Icon name={it.icon} size={18} /><span>{it.label}</span></Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="side-foot"><small className="loc">{es.screens.shell.localNote}</small></div>
      </aside>
      <div className="scrim" onClick={() => setNavOpen(false)} />
      <main className="main" id="main">
        {banner}
        <div className="page" id="view" tabIndex={-1}>{children}</div>
      </main>
    </div>
  );
}

export function PageHead({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="ph">
      <div><h1>{title}</h1>{sub ? <p className="sub">{sub}</p> : null}</div>
      <div className="ph-a">{actions}</div>
    </header>
  );
}
