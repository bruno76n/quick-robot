// Buscar en todo (⌘K / Ctrl+K, docs/06 §1; mockup palItems/palRender/palOpen/palIr): actions, screens and the
// server search (GET /search, from 2 letters). ↑ ↓ move, Enter opens, Esc closes.
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { create } from 'zustand';
import { es } from '../i18n/es';
import { t } from '../i18n/t';
import { qs, request } from '../lib/api';
import { centsTotal, date, grams, number1 } from '../lib/format';
import { go } from '../lib/nav';
import { keys } from '../lib/queries';
import { NAV } from './AppShell';

const L = es.screens.palette;

/** "Registrar un gasto" from the command palette: the page opens the dialog when it mounts. */
let pendingNew = false;
const listeners = new Set<() => void>();
export const requestNewExpense = () => { if (listeners.size) listeners.forEach((fn) => fn()); else pendingNew = true; };
export const takeNewExpenseRequest = () => { const v = pendingNew; pendingNew = false; return v; };
export const onNewExpenseRequest = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };


interface PaletteState { palette: boolean; shortcuts: boolean; set: (s: Partial<Pick<PaletteState, 'palette' | 'shortcuts'>>) => void }
export const usePalette = create<PaletteState>((set) => ({ palette: false, shortcuts: false, set: (s) => set(s) }));
export const openPalette = () => usePalette.getState().set({ palette: true, shortcuts: false });
export const openShortcuts = () => usePalette.getState().set({ shortcuts: true, palette: false });

export interface SearchResult {
  products: { id: string; name: string; listCents?: number }[]; collections?: { id: string; name: string; priceCents: number }[];
  customers: { id: string; name: string; type?: string; phone?: string }[];
  orders: { id: string; number: number; customer: string; status: keyof typeof es.status.order; itemsText?: string }[];
  sales: { id: string; on: string; itemsText: string; customer: string; totalCents?: number }[];
  filaments: { id: string; name: string; hex: string; remainingGrams?: number }[];
  supplies?: { id: string; name: string; stock: number; unit: string }[];
}
export interface PalItem { kind: keyof typeof L.kind; title: string; sub: string; run: () => void; q: string }

export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const item = (kind: PalItem['kind'], title: string, sub: string, run: () => void): PalItem => ({ kind, title, sub, run, q: norm(`${title} ${sub}`) });

/** Actions and screens: always there, filtered by the words typed. */
export function localItems(): PalItem[] {
  return [
    item('action', L.newSale, L.newSaleSub, () => go('/armar?modo=venta')),
    item('action', L.newOrder, L.newOrderSub, () => go('/armar?modo=pedido')),
    item('action', L.newPiece, L.newPieceSub, () => go('/productos/pieza')),
    item('action', L.newExpense, '', () => { requestNewExpense(); go('/gastos'); }),
    item('action', L.shortcuts, L.shortcutsSub, openShortcuts),
    ...NAV.flatMap(([, items]) => items.map((n) => item('screen', n.label, '', () => go(n.to)))),
  ];
}

/** What the server found, as palette items (each opens its element). */
export function remoteItems(r: SearchResult): PalItem[] {
  const two = (text = '') => { const parts = text.split(', ').filter(Boolean); return parts.length > 2 ? t('screens.palette.andMore', { items: parts.slice(0, 2).join(' + '), count: parts.length - 2 }) : parts.join(' + '); };
  return [
    ...r.products.map((p) => item('piece', p.name, p.listCents !== undefined ? centsTotal(p.listCents) : '', () => go(`/productos/pieza?id=${p.id}`))),
    ...(r.collections ?? []).map((c) => item('collection', c.name, centsTotal(c.priceCents), () => go(`/productos/coleccion?id=${c.id}`))),
    ...r.customers.map((c) => item('customer', c.name, [c.type, c.phone].filter(Boolean).join(' · '), () => go(`/clientes/cliente?id=${c.id}`))),
    ...r.orders.map((o) => item('order', t('screens.palette.orderTitle', { number: o.number, customer: o.customer }), [es.status.order[o.status] ?? '', two(o.itemsText)].filter(Boolean).join(' · '), () => go(`/pedidos/pedido?id=${o.id}`))),
    ...r.sales.map((s) => item('sale', s.totalCents !== undefined ? t('screens.palette.saleTitle', { date: date(s.on), total: centsTotal(s.totalCents) }) : date(s.on), [s.customer, two(s.itemsText)].filter(Boolean).join(' · '), () => go(`/ventas?v=${s.id}`))),
    ...r.filaments.map((f) => item('filament', f.name, f.remainingGrams !== undefined ? grams(f.remainingGrams) : '', () => go(`/filamentos?f=${f.id}`))),
    ...(r.supplies ?? []).map((x) => item('supply', x.name, `${number1(x.stock)} ${x.unit || es.screens.supplies.pza}`, () => go(`/insumos?i=${x.id}`))),
  ];
}

export function filterItems(local: readonly PalItem[], remote: readonly PalItem[], q: string): PalItem[] {
  const ws = norm(q).split(' ').filter(Boolean);
  if (!ws.length) return local.slice(0, 40);
  const hits = [...remote, ...local.filter((it) => ws.every((w) => it.q.includes(w)))];
  return hits.map((it, i) => ({ it, i, s: norm(it.title).startsWith(ws[0]!) ? 0 : 1 })).sort((a, b) => a.s - b.s || a.i - b.i).map((x) => x.it).slice(0, 40);
}

function useDebounced(v: string, ms: number) {
  const [d, setD] = useState(v);
  useEffect(() => { const id = setTimeout(() => setD(v), ms); return () => clearTimeout(id); }, [v, ms]);
  return d;
}

export function CommandPalette() {
  const open = usePalette((s) => s.palette);
  const set = usePalette((s) => s.set);
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const dq = useDebounced(q.trim(), 150);
  const remote = useQuery({
    queryKey: [...keys.search, dq], enabled: open && dq.length >= 2, staleTime: 10_000,
    queryFn: async ({ signal }) => (await request<SearchResult>('GET', `/search${qs({ q: dq })}`, undefined, signal)).data,
  });
  const local = useMemo(() => localItems(), []);
  const res = filterItems(local, dq.length >= 2 && remote.data && dq === q.trim() ? remoteItems(remote.data) : [], q);
  const cur = Math.min(sel, Math.max(0, res.length - 1));
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { setQ(''); setSel(0); if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', ''); input.current?.focus(); }
    if (!open && d.open) { if (typeof d.close === 'function') d.close(); else d.removeAttribute('open'); }
  }, [open]);
  useEffect(() => { list.current?.querySelector('.on')?.scrollIntoView?.({ block: 'nearest' }); }, [cur]);
  const close = () => set({ palette: false });
  const pick = (i: number) => { const it = res[i]; if (!it) return; close(); setTimeout(it.run, 0); };
  const searching = dq.length >= 2 && (remote.isFetching || dq !== q.trim());
  return (
    <dialog ref={ref} id="pal" className="pal" aria-label={L.label} onCancel={(e) => { e.preventDefault(); close(); }} onClick={(e) => { if (e.target === ref.current) close(); }}>
      {open ? (
        <div className="pal-b">
          <input id="pal-q" ref={input} type="text" autoComplete="off" placeholder={L.placeholder} aria-label={L.search} value={q} role="combobox" aria-expanded aria-controls="pal-l"
            aria-activedescendant={res[cur] ? `pal-o-${cur}` : undefined}
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            onKeyDown={(e) => {
              const n = res.length;
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (n) setSel((cur + (e.key === 'ArrowDown' ? 1 : n - 1)) % n); }
              else if (e.key === 'Enter') { e.preventDefault(); pick(cur); }
            }} />
          <ul id="pal-l" role="listbox" ref={list} aria-label={L.label}>
            {res.length ? res.map((it, i) => (
              <li key={`${it.kind}-${i}-${it.title}`}>
                <button type="button" id={`pal-o-${i}`} className={i === cur ? 'on' : undefined} role="option" aria-selected={i === cur} onMouseMove={() => { if (i !== cur) setSel(i); }} onClick={() => pick(i)}>
                  <span className="pal-k">{L.kind[it.kind]}</span><span className="pal-t"><b>{it.title}</b>{it.sub ? <small>{it.sub}</small> : null}</span>
                </button>
              </li>
            )) : <li className="pal-e">{searching ? L.searching : t('screens.palette.empty', { q })}</li>}
          </ul>
          <p className="pal-f"><kbd>{'↑'}</kbd><kbd>{'↓'}</kbd> {L.move} <kbd>{'Enter'}</kbd> {L.open} <kbd>{'Esc'}</kbd> {L.close}</p>
        </div>
      ) : null}
    </dialog>
  );
}
