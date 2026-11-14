// Frame of every screen (docs/06 §1, ronda-3 §3, reference/ronda-3 .ui-side/.ui-mtop): white sidebar with the mascot,
// the business name and trade (from Ajustes, never from code: D30; grey placeholders when empty), Buscar ⌘K, the
// groups of screens with grey counters (D-6) and the current one in grey and semibold. At ≤ 1099 px the sidebar is a
// drawer opened from a fixed top bar (menu, screen title, «+»); Esc or a tap outside closes it and the focus goes back
// to the menu button. The mascot is the owner's brand mark (person's decision, docs/decisiones.md 2026-11-13 and E3).
import { Link, useRouterState } from '@tanstack/react-router';
import { forwardRef, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { es } from '../i18n/es';
import { t } from '../i18n/t';
import { Icon } from './Icon';
import { Mascot } from './Mascot';
import { ScreenTitle } from './PageHead';

export { PageHead } from './PageHead';

export interface NavItem { to: string; label: string; icon: string }
export const NAV: readonly (readonly [string | null, readonly NavItem[]])[] = [
  [null, [{ to: '/inicio', label: es.nav.home, icon: 'home' }]],
  [es.nav.groupSell, [{ to: '/productos', label: es.nav.products, icon: 'box' }, { to: '/ventas', label: es.nav.sales, icon: 'coin' }, { to: '/pedidos', label: es.nav.orders, icon: 'list' }]],
  [es.nav.groupWorkshop, [
    { to: '/filamentos', label: es.nav.filaments, icon: 'spool' }, { to: '/insumos', label: es.nav.supplies, icon: 'nut' }, { to: '/impresoras', label: es.nav.printers, icon: 'printer' },
    { to: '/produccion', label: es.nav.production, icon: 'layers' }, { to: '/existencias', label: es.nav.stock, icon: 'store' }, { to: '/compras', label: es.nav.purchases, icon: 'cart' }]],
  [es.nav.groupBusiness, [{ to: '/clientes', label: es.nav.customers, icon: 'users' }, { to: '/gastos', label: es.nav.expenses, icon: 'wallet' }, { to: '/reportes', label: es.nav.reports, icon: 'chart' }, { to: '/ajustes', label: es.nav.settings, icon: 'gear' }]],
];

/** Grey counters of the menu by path (D-6): orders in progress and suggested purchases. */
export type NavCounts = Partial<Record<string, number>>;
const COUNT_TEXT: Record<string, string> = { '/pedidos': 'nav.ordersCount', '/compras': 'nav.purchasesCount' };

export function AppShell({ businessName, trade, known = true, banner, counts, onNewPiece, onSearch, children }: { businessName: string; trade: string; known?: boolean; banner?: ReactNode; counts?: NavCounts | undefined; onNewPiece?: () => void; onSearch?: () => void; children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  // The menu closes by itself when the route changes: it is open only for the path where it was opened.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const navOpen = openAt === path;
  const menuBtn = useRef<HTMLButtonElement>(null);
  const side = useRef<HTMLElement>(null);
  const open = () => setOpenAt(path);
  const close = useCallback((back = true) => { setOpenAt(null); if (back) menuBtn.current?.focus(); }, []);
  useEffect(() => { document.body.classList.toggle('nav-open', navOpen); }, [navOpen]);
  useEffect(() => {
    if (!navOpen) return;
    // Focus goes into the menu (the current screen, else the first link); Esc closes it.
    (side.current?.querySelector<HTMLElement>('.nav a[aria-current="page"]') ?? side.current?.querySelector<HTMLElement>('.nav a'))?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navOpen, close]);
  useSplitPanes();
  const [screenTitle, setScreenTitle] = useState<string | null>(null);
  const section = `/${path.split('/')[1] ?? ''}`;
  const sectionLabel = NAV.flatMap(([, items]) => items).find((it) => it.to === section)?.label ?? '';
  return (
    <ScreenTitle.Provider value={setScreenTitle}>
      <div className="app" id="app">
        <header className="topbar">
          <button ref={menuBtn} type="button" className="menu-b" onClick={() => (navOpen ? close() : open())} aria-label={es.common.openMenu} aria-expanded={navOpen} aria-controls="side"><Icon name="menu" size={20} /></button>
          <b className="t-title">{screenTitle ?? sectionLabel}</b>
          <button type="button" className="btn primary icon" onClick={onNewPiece} disabled={!onNewPiece} aria-label={es.nav.newPiece} title={es.nav.newPiece}><Icon name="plus" size={16} /></button>
        </header>
        <Sidebar ref={side} businessName={businessName} trade={trade} known={known} section={section} counts={counts} onNewPiece={onNewPiece} onSearch={onSearch} />
        <div className="scrim" onClick={() => close()} />
        <main className="main" id="main">
          {banner}
          <div className="page" id="view" tabIndex={-1}>{children}</div>
        </main>
      </div>
    </ScreenTitle.Provider>
  );
}

/** The sidebar (≥ 1100 px fixed, below that the drawer): mascot, name and trade, search, «Nueva pieza» and the screens. */
const Sidebar = forwardRef<HTMLElement, { businessName: string; trade: string; known: boolean; section: string; counts?: NavCounts | undefined; onNewPiece?: (() => void) | undefined; onSearch?: (() => void) | undefined }>(
  function Sidebar({ businessName, trade, known, section, counts, onNewPiece, onSearch }, ref) {
    const name = businessName.trim();
    return (
      <aside ref={ref} className="side" id="side" aria-label={es.common.mainMenu}>
        <div className="brand">
          <span className="mk"><Mascot size={36} /></span>
          {/* Until Ajustes arrives (or if it fails) nothing is written: the placeholders mean "no name yet", not "not loaded". */}
          {known ? <div><b className={name ? undefined : 'ph-txt'}>{name || es.sidebar.businessPlaceholder}</b>{trade.trim() ? <small>{trade}</small> : <small className="ph-txt">{es.sidebar.industryPlaceholder}</small>}</div> : <div><b>{name}</b><small /></div>}
        </div>
        <button type="button" className="srch" onClick={onSearch} aria-label={es.common.searchAll}><Icon name="search" size={15} /><span>{es.common.search}</span><kbd aria-hidden="true" data-k={es.common.searchShortcut} /></button>
        <button type="button" className="btn primary block new-b" onClick={onNewPiece} disabled={!onNewPiece}><Icon name="plus" size={14} />{es.nav.newPiece}</button>
        <nav className="nav" aria-label={es.common.screens}>
          {NAV.map(([group, items]) => (
            <div className="ng" key={group ?? 'top'}>
              {group ? <span className="ngl">{group}</span> : null}
              {items.map((it) => {
                const n = counts?.[it.to];
                const nText = COUNT_TEXT[it.to];
                return (
                  <Link key={it.to} to={it.to} aria-current={section === it.to ? 'page' : undefined}>
                    <Icon name={it.icon} size={16} /><span>{it.label}</span>
                    {n && nText ? <em className="cnt num"><span aria-hidden="true">{n}</span><span className="sr">{t(nText, { count: n })}</span></em> : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="side-foot"><small className="loc">{es.screens.shell.localNote}</small></div>
      </aside>
    );
  },
);

/** Split screens scroll each side on its own (mockup: .pn-s, .pn-e, .pn-p on #main). */
function useSplitPanes() {
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
}
