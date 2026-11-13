// Existencias (docs/06 §10, mejoras/ronda-2.md §4): finished pieces by family, as Lista (default) or Fichas, with
// filters by state, search, fewest-free-first order and a drawer per piece with movements (StockDrawer).
import { useSearch } from '@tanstack/react-router';
import { Fragment, useDeferredValue, useState, type CSSProperties, type ReactNode } from 'react';
import { PageHead } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { toast } from '../../components/Toast';
import { es } from '../../i18n/es';
import { fill, formatParam, t, type Params } from '../../i18n/t';
import { centsTotal } from '../../lib/format';
import { go } from '../../lib/nav';
import { PrintRunDialog } from '../production/PrintRunDialog';
import { Piece3d } from '../products/Piece3d';
import { useStock, type StockFilter, type StockMember, type StockRow, type StockSort, type StockStatus } from './api';
import { AdjustDialog, EnableDialog } from './StockDialogs';
import { StockDrawer, type Dlg } from './StockDrawer';
import './stock.css';

const L = es.screens.stock;
type View = 'fichas' | 'lista';
const VIEW_KEY = 'view.stock';
const FILTERS: { key: StockFilter; count: 'all' | 'few' | 'allReserved' | 'ok' | 'out'; label: string }[] = [
  { key: 'all', count: 'all', label: L.filter.all }, { key: 'few', count: 'few', label: L.filter.few },
  { key: 'all_reserved', count: 'allReserved', label: L.filter.allReserved }, { key: 'ok', count: 'ok', label: L.filter.ok },
  { key: 'out', count: 'out', label: L.filter.out },
];
const FILTER_CLASS: Record<StockFilter, string> = { all: '', few: 'few', all_reserved: '', ok: 'ok', out: 'out' };

/** D-7: `?vista=` wins; otherwise the remembered view of this screen; otherwise Lista. */
function storedView(): View | null {
  try { const v = localStorage.getItem(VIEW_KEY); return v === 'fichas' || v === 'lista' ? v : null; } catch { return null; }
}
function rememberView(v: View) {
  try { localStorage.setItem(VIEW_KEY, v); } catch { /* private window: the URL still carries it */ }
}

/** The summary with some figures in bold, as the mockup shows it. */
function boldSome(key: string, template: string, params: Params, bold: string[]): ReactNode {
  try {
    const marked = template.replace(/\{([A-Za-z0-9_]+)\}/g, (m, n: string) => (bold.includes(n) ? `${bold.indexOf(n)}` : m));
    return fill(marked, params).split(/(\d+)/).map((p, i) => (i % 2 ? <b key={i}>{formatParam(bold[Number(p)]!, params[bold[Number(p)]!])}</b> : <Fragment key={i}>{p}</Fragment>));
  } catch {
    return t(key, params);
  }
}

const Chevron = ({ dir = 'right' }: { dir?: 'right' | 'up' | 'down' }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={dir === 'right' ? 'm9 6 6 6-6 6' : dir === 'up' ? 'M12 19V5M5 12l7-7 7 7' : 'M12 5v14M5 12l7 7 7-7'} />
  </svg>
);
const Thumb = ({ p }: { p: { photoUrl: string | null; hexes: string[]; productId: string } }) => (
  <span className="sk-thumb">{p.photoUrl ? <img src={p.photoUrl} alt="" /> : <Piece3d hexes={p.hexes} id={p.productId} cls="sm" />}</span>
);
const Dot = ({ hex }: { hex: string | undefined }) => <span className="sk-dot" style={hex ? ({ '--c': hex } as CSSProperties) : undefined} />;
const StatePill = ({ status }: { status: StockStatus }) => <span className={`pill ${STATE_PILL[status]}`}>{es.status.stock[status]}</span>;
const STATE_PILL: Record<StockStatus, string> = { out: 'bad', all_reserved: 'info', few: 'warn', ok: 'good' };
const memberName = (m: StockMember) => (m.isOriginal ? m.name : m.label ?? m.displayName);
/** The piece whose drawer a card opens: the original if it carries stock, else the first member. */
const drawerIdOf = (r: StockRow) => r.members[0]?.productId ?? r.productId;

export function StockPage() {
  const search = useSearch({ strict: false }) as { p?: string; vista?: string };
  const [stored, setStored] = useState<View | null>(storedView);
  const view: View = search.vista === 'fichas' || search.vista === 'lista' ? search.vista : stored ?? 'lista';
  const [status, setStatus] = useState<StockFilter>('all');
  const [sort, setSort] = useState<StockSort>('free_asc');
  const [q, setQ] = useState('');
  const needle = useDeferredValue(q.trim());
  const [dlg, setDlg] = useState<Dlg>(null);
  const query = useStock({ q: needle, status, sort });
  const first = query.data?.pages[0];
  const rows = query.data?.pages.flatMap((pg) => pg.items) ?? [];

  const href = (p: string | null, vista: View | undefined) => {
    const s = new URLSearchParams();
    if (vista) s.set('vista', vista);
    if (p) s.set('p', p);
    return `/existencias${s.size ? `?${s}` : ''}`;
  };
  const urlView = search.vista === 'fichas' || search.vista === 'lista' ? search.vista : undefined;
  const select = (id: string | null) => go(href(id, urlView), true);
  const setView = (v: View) => { rememberView(v); setStored(v); go(href(search.p ?? null, v), true); };
  const enable = () => { if (first && !first.untracked.length) toast(es.toast['stock.allTracked']); else setDlg({ kind: 'enable' }); };
  const T = first?.totals;
  const anyStock = Boolean(first && (first.counts.all > 0 || needle));
  const hexesOf = (id: string | null) => {
    for (const r of rows) { if (r.productId === id) return r.hexes; const m = r.members.find((x) => x.productId === id); if (m) return m.hexes; }
    return [];
  };

  return (
    <>
      <PageHead
        title={L.title}
        sub={T && T.pieces ? boldSome('screens.stock.summary', L.summary, { units: T.units, pieces: T.pieces, free: T.free, reserved: T.reserved }, ['units', 'free', 'reserved']) : L.subEmpty}
        actions={<><Button variant="primary" icon="plus" onClick={() => setDlg({ kind: 'print' })}>{L.register}</Button><Button onClick={enable}>{L.enableOther}</Button></>}
      />
      {first && !anyStock ? (
        <div className="empty-card"><p>{L.empty}</p><Button variant="primary" icon="plus" onClick={() => setDlg({ kind: 'print' })}>{L.register}</Button> <Button onClick={enable}>{L.enableOne}</Button></div>
      ) : (
        <>
          <div className="sk-tools">
            <div className="sk-filters" role="group" aria-label={L.filter.aria}>
              {FILTERS.map((f) => (
                <button key={f.key} type="button" className={`sk-f ${FILTER_CLASS[f.key]}${status === f.key ? ' on' : ''}`} aria-pressed={status === f.key} onClick={() => setStatus(f.key)}>
                  {f.label} <span>{first?.counts[f.count] ?? 0}</span>
                </button>
              ))}
            </div>
            <div className="tb-r">
              <label className="search"><span className="sr">{es.common.search}</span><input type="search" placeholder={L.search} value={q} onChange={(e) => setQ(e.target.value)} /></label>
              <div className="seg2" role="group" aria-label={L.view.aria}>
                {(['fichas', 'lista'] as const).map((k) => <button key={k} type="button" className={view === k ? 'on' : ''} aria-pressed={view === k} onClick={() => setView(k)}>{k === 'fichas' ? L.view.cards : L.view.list}</button>)}
              </div>
            </div>
          </div>
          {view === 'lista'
            ? <StockList rows={rows} selected={search.p ?? null} needle={needle} sort={sort} onSort={() => setSort(sort === 'free_asc' ? 'free_desc' : 'free_asc')} onOpen={select} />
            : <StockCards rows={rows} selected={search.p ?? null} onOpen={select} />}
          {query.data && !rows.length ? <p className="muted">{L.noMatch}</p> : null}
          {query.hasNextPage ? <div className="sk-more"><Button onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage}>{L.more}</Button></div> : null}
        </>
      )}
      <StockDrawer id={search.p ?? null} hexes={hexesOf(search.p ?? null)} onClose={() => select(null)} open={setDlg} />
      {dlg?.kind === 'print' ? <PrintRunDialog productId={dlg.productId} onClose={() => setDlg(null)} /> : null}
      {dlg?.kind === 'adjust' ? <AdjustDialog detail={dlg.detail} onClose={() => setDlg(null)} /> : null}
      {dlg?.kind === 'enable' && first ? <EnableDialog candidates={first.untracked} onClose={() => setDlg(null)} onDone={(id) => { setDlg(null); select(id); }} /> : null}
    </>
  );
}

/** Lista: Pieza · Estado · Libres · Apartadas · Total · Precio de lista; a family row unfolds its members. */
function StockList({ rows, selected, needle, sort, onSort, onOpen }: {
  rows: StockRow[]; selected: string | null; needle: string; sort: StockSort; onSort: () => void; onOpen: (id: string) => void;
}) {
  const [toggled, setToggled] = useState<ReadonlySet<string>>(new Set());
  const flip = (id: string) => setToggled((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const lower = needle.toLocaleLowerCase('es');
  return (
    <div className="sk-table" data-testid="stock-list">
      <div className="sk-head" role="presentation">
        <span>{L.col.piece}</span><span>{L.col.state}</span>
        <span className="r"><button type="button" className="sk-sort" onClick={onSort} aria-label={sort === 'free_asc' ? L.sortFewFirst : L.sortMostFirst}>{L.col.free} <Chevron dir={sort === 'free_asc' ? 'up' : 'down'} /></button></span>
        <span className="r">{L.col.reserved}</span><span className="r">{L.col.total}</span><span className="r">{L.col.listPrice}</span><span />
      </div>
      {rows.map((r) => {
        const family = r.members.length > 0;
        // A search that only matches a variant, or a selected member, shows the family open.
        const auto = family && ((lower !== '' && !r.name.toLocaleLowerCase('es').includes(lower)) || r.members.some((m) => m.productId === selected));
        const open = family && toggled.has(r.productId) !== auto;
        const sub = [r.printerName, family ? t('screens.stock.variantsSub', { count: r.members.length }) : null].filter(Boolean).join(' · ');
        return (
          <div key={r.productId} className="sk-item" data-testid="stock-row" data-family={family ? 'true' : undefined}>
            <div className={`sk-row sk ${r.status} click${!family && selected === r.productId ? ' sel' : ''}`} onClick={() => (family ? flip(r.productId) : onOpen(r.productId))}>
              <div className="sk-cell-piece">
                {family
                  ? <button type="button" className="sk-chev" aria-expanded={open} aria-label={open ? L.hideVariants : L.showVariants} onClick={(e) => { e.stopPropagation(); flip(r.productId); }}><Chevron /></button>
                  : <span className="sk-gap" />}
                <Thumb p={r} />
                <div className="sk-name"><b>{r.name}</b>{sub ? <small>{sub}</small> : null}</div>
              </div>
              <Cells x={r} />
              <span className="sk-act">{family ? null : <OpenBtn name={r.name} onClick={() => onOpen(r.productId)} />}</span>
            </div>
            {open ? (
              <div className="sk-members">
                {r.members.map((m) => (
                  <div key={m.productId} className={`sk-row sk ${m.status} click${selected === m.productId ? ' sel' : ''}`} data-testid="stock-member" onClick={() => onOpen(m.productId)}>
                    <div className="sk-cell-piece">
                      <Dot hex={m.hexes[0]} />
                      <div className="sk-name"><b>{memberName(m)}</b>{m.isOriginal ? <> <span className="sk-orig">{L.original}</span></> : null}</div>
                    </div>
                    <Cells x={m} />
                    <span className="sk-act"><OpenBtn name={m.displayName} onClick={() => onOpen(m.productId)} /></span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function Cells({ x }: { x: StockRow | StockMember }) {
  return (
    <>
      <span className="sk-state"><StatePill status={x.status} /></span>
      <span className="r"><span className="sk-lbl">{L.col.free}</span><span className="sk-free" data-testid="stock-free">{x.free}</span></span>
      <span className="r sk-num res"><span className="sk-lbl">{L.col.reserved}</span>{x.reserved}</span>
      <span className="r sk-num tot"><span className="sk-lbl">{L.col.total}</span><span data-testid="stock-total">{x.physical}</span></span>
      <span className="r sk-num price"><span className="sk-lbl">{L.col.listPrice}</span>{centsTotal(x.listCents)}</span>
    </>
  );
}

const OpenBtn = ({ name, onClick }: { name: string; onClick: () => void }) => (
  <button type="button" className="sk-open" aria-label={t('screens.stock.open', { name })} onClick={(e) => { e.stopPropagation(); onClick(); }}><Chevron /></button>
);

/** Fichas: one card per family; a big free number, a thin bar of free against reserved, and free per variant. */
function StockCards({ rows, selected, onOpen }: { rows: StockRow[]; selected: string | null; onOpen: (id: string) => void }) {
  return (
    <div className="sk-grid">
      {rows.map((r) => {
        const target = drawerIdOf(r);
        const isSel = selected === target || (!r.members.length && selected === r.productId);
        return (
          <article key={r.productId} className={`sk-card sk ${r.status}${isSel ? ' sel' : ''}`} tabIndex={0} data-testid="stock-card"
            aria-label={r.name} onClick={() => onOpen(target)} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onOpen(target); }}>
            <div className="sk-card-h">
              <Thumb p={r} />
              <div className="sk-name"><b>{r.name}</b>{r.printerName ? <small>{r.printerName}</small> : null}</div>
              <StatePill status={r.status} />
            </div>
            <div className="sk-big">
              <span><span className="sk-free" data-testid="stock-free">{r.free}</span>{t('screens.stock.card.free', { count: r.free })}</span>
              <small data-testid="stock-total">{t('screens.stock.card.ofTotal', { total: r.physical })}</small>
            </div>
            <div className="sk-bar" role="img" aria-label={t('screens.stock.card.bar', { free: r.free, reserved: r.reserved })}>
              {r.free > 0 ? <span className="f" style={{ flex: `${r.free} 1 0%` }} /> : null}
              {r.reserved > 0 ? <span className="a" style={{ flex: `${r.reserved} 1 0%` }} /> : null}
            </div>
            <div className="sk-foot"><span>{t('screens.stock.card.reserved', { count: r.reserved })}</span><b>{centsTotal(r.listCents)}</b></div>
            {r.members.length ? (
              <div className="sk-vars">
                <div>{t('screens.stock.card.variantsFree', { count: r.members.length })}</div>
                {r.members.map((m) => (
                  <button key={m.productId} type="button" className={`sk-var sk ${m.status}${selected === m.productId ? ' sel' : ''}`} data-testid="stock-variant"
                    aria-label={t('screens.stock.open', { name: m.displayName })} onClick={(e) => { e.stopPropagation(); onOpen(m.productId); }}>
                    <Dot hex={m.hexes[0]} /><span>{m.isOriginal ? L.original : memberName(m)}</span><span className="sk-free">{m.free}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
