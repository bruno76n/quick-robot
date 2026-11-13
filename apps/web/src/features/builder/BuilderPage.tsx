// Armar venta o pedido (docs/06 §4.2, mockup vNuevo): one screen for both. Lines of pieces and sets with quantity and
// price, a general discount, where each piece comes from, and Total, Costo and Ganancia computed with @app/core.
// The server recalculates and saves its own numbers.
import type { Warning } from '@app/contract';
import { addDays } from '@app/core';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '../../components/Button';
import { Mascot } from '../../components/Mascot';
import { toast } from '../../components/Toast';
import { UnitInput } from '../../components/UnitInput';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { api } from '../../lib/api';
import { money2d, moneyTotal } from '../../lib/format';
import { parseNumber, todayLocal } from '../../lib/input';
import { useWrite } from '../../lib/mutate';
import { go } from '../../lib/nav';
import { keys, useCollections, useProducts, useSettings } from '../../lib/queries';
import { CustomerDialog } from '../customers/CustomerDialog';
import { useCustomers } from '../customers/CustomersPage';
import { rich } from '../sales/rich';
import { builderApi, type OrderForEdit } from './api';
import { calc, lineQty, splitSet, type Defs, type Line } from './calc';
import { LineView, Pick, Summary } from './Parts';

const L = es.screens.builder;
const NEW = '__nuevo';
const fmtNum = (x: number) => String(Math.round((x || 0) * 100) / 100);
type Search = { modo?: string; id?: string; cliente?: string; pieza?: string; coleccion?: string };

export function BuilderPage() {
  const s = useSearch({ strict: false }) as Search;
  const order = useQuery({ queryKey: [...keys.orders, 'detail', s.id], queryFn: async () => (await builderApi.order(s.id!)).data, enabled: Boolean(s.id) });
  const products = useProducts().data;
  const collections = useCollections().data;
  const settings = useSettings().data;
  if (!products || !collections || !settings || (s.id && !order.data)) return <div className="skel" />;
  return <Builder key={JSON.stringify(s)} search={s} edit={s.id ? order.data! : null} />;
}

interface State {
  order: boolean; customerId: string; on: string; dueOn: string; channelId: string; deposit: string; paidNow: string; accepted: boolean; note: string; gPct: number; q: string; lines: Line[];
}

function Builder({ search, edit }: { search: Search; edit: OrderForEdit | null }) {
  const products = useProducts().data!.items;
  const collections = useCollections().data!.items;
  const { settings, channels } = useSettings().data!;
  const customers = useCustomers().data ?? [];
  const filaments = useQuery({ queryKey: [...keys.filaments, 'builder'], queryFn: async () => (await api.filaments.list({ pageSize: 200 })).data }).data?.items ?? [];
  const today = todayLocal();
  const [B, setB] = useState<State>(() => {
    const lines: Line[] = [];
    if (edit) for (const it of edit.items) lines.push({ kind: it.kind, id: (it.kind === 'set' ? it.collectionId : it.productId) ?? '', qty: String(it.qty), unit: fmtNum(it.priceCents / 100), ...(Object.keys(it.fromStock).length ? { man: { ...it.fromStock } } : {}) });
    const p = search.pieza ? products.find((x) => x.id === search.pieza) : undefined;
    const c = search.coleccion ? collections.find((x) => x.id === search.coleccion) : undefined;
    if (p) lines.push({ kind: 'piece', id: p.id, qty: '1', unit: fmtNum(p.listCents / 100) });
    if (c) lines.push({ kind: 'set', id: c.id, qty: '1', unit: fmtNum(c.listCents / 100) });
    return {
      order: search.modo === 'pedido' || Boolean(edit), customerId: edit?.customerId ?? (search.cliente ?? ''), on: today, dueOn: edit?.dueOn ?? addDays(today, 7),
      channelId: edit?.channelId ?? channels[0]?.id ?? '', deposit: '', paidNow: '', accepted: edit ? edit.status === 'accepted' : false, note: edit?.note ?? '', gPct: 0, q: '',
      lines: lines.filter((l) => (l.kind === 'set' ? collections.some((x) => x.id === l.id) : products.some((x) => x.id === l.id))),
    };
  });
  const [creating, setCreating] = useState<null | 'new' | 'edit'>(null);
  const [focus, setFocus] = useState<{ total?: string; gPct?: string }>({});
  const set = (patch: Partial<State>) => setB((b) => ({ ...b, ...patch }));
  const setLine = (i: number, patch: Partial<Line>) => setB((b) => ({ ...b, lines: b.lines.map((l, k) => (k === i ? { ...l, ...patch } : l)) }));

  // Parts of the sets in the lines and the filaments of the pieces (only what the preview needs).
  const setIds = [...new Set(B.lines.filter((l) => l.kind === 'set').map((l) => l.id))];
  const setDetails = useQueries({ queries: setIds.map((id) => ({ queryKey: [...keys.collections, 'detail', id], queryFn: async () => (await api.collections.get(id)).data })) });
  const partsOf = new Map(setDetails.flatMap((q) => (q.data ? [[q.data.id, q.data.parts.map((p) => ({ productId: p.productId, qty: p.qty }))] as const] : [])));
  const pieceIds = B.order ? [...new Set(B.lines.flatMap((l) => (l.kind === 'piece' ? [l.id] : (partsOf.get(l.id) ?? []).map((p) => p.productId))))] : [];
  const pieceDetails = useQueries({ queries: pieceIds.map((id) => ({ queryKey: [...keys.products, 'detail', id], queryFn: async () => (await api.products.get(id)).data })) });
  const filamentsOf = new Map(pieceDetails.flatMap((q) => (q.data ? [[q.data.id, q.data.filaments] as const] : [])));
  const freeNow = new Map<string, number>();
  for (const it of edit?.items ?? []) for (const [pid, n] of Object.entries(it.freeNow)) freeNow.set(pid, n);
  const byProduct = new Map(products.map((p) => [p.id, p]));
  const defs: Defs = {
    pieces: new Map(products.map((p) => [p.id, { id: p.id, name: p.displayName, list: p.listCents / 100, cost: p.costCents / 100, hours: p.hours, tracks: p.tracksStock, ...(filamentsOf.has(p.id) ? { filaments: filamentsOf.get(p.id)! } : {}) }])),
    sets: new Map(collections.map((c) => [c.id, { id: c.id, name: c.name, list: c.listCents / 100, cost: c.costCents / 100, parts: partsOf.get(c.id) ?? [] }])),
    free: (pid) => Math.max(0, freeNow.get(pid) ?? byProduct.get(pid)?.free ?? 0),
  };
  const channel = channels.find((c) => c.id === B.channelId);
  const C = calc(B.lines, defs, { order: B.order, gPct: B.gPct, commissionPct: channel?.commissionPct ?? 0, minMarginPct: settings.minMarginPct });
  const customer = customers.find((c) => c.id === B.customerId);

  const add = (kind: 'piece' | 'set', id: string, list: number) => setB((b) => {
    const k = b.lines.findIndex((l) => l.kind === kind && l.id === id);
    if (k >= 0) return { ...b, lines: b.lines.map((l, j) => (j === k ? { ...l, qty: String(lineQty(l) + 1) } : l)) };
    return { ...b, lines: [...b.lines, { kind, id, qty: '1', unit: fmtNum(list) }] };
  });
  const toOrder = () => { set({ order: true }); toast(es.toast['builder.toOrder']); };
  const back = edit ? `/pedidos/pedido?id=${edit.id}` : B.order ? '/pedidos' : '/ventas';

  const save = useWrite(async (): Promise<{ data: { folio: number | null; id: string; warnings: Warning[]; owedCents: number } }> => {
    const f = 1 - B.gPct / 100;
    const items = C.rows.map((r) => {
      const fromStock = Object.fromEntries(Object.entries(r.use).filter(([, n]) => n > 0));
      return {
        kind: r.line.kind, ...(r.set ? { collectionId: r.line.id } : { productId: r.line.id }), qty: r.n, priceCents: Math.max(0, Math.round(r.unit * f * 100)),
        ...(B.order && Object.keys(fromStock).length ? { fromStock } : {}),
      };
    });
    const note = B.note.trim();
    if (!B.order) {
      const paid = B.paidNow.trim();
      const out = await builderApi.createSale({ on: B.on || today, channelId: B.channelId, customerId: B.customerId || null, ...(note ? { note } : {}), items, ...(paid !== '' ? { paidNowCents: Math.max(0, Math.round(parseNumber(paid) * 100)) } : {}) });
      return { data: { folio: null, id: out.data.id, warnings: out.warnings, owedCents: out.data.totals.owedCents } };
    }
    const base = { customerId: B.customerId, channelId: B.channelId, dueOn: B.dueOn, ...(note ? { note } : {}), items };
    const out = edit
      ? await builderApi.updateOrder(edit.id, { ...base, createdOn: edit.createdOn })
      : await builderApi.createOrder({ ...base, createdOn: today, accepted: B.accepted, depositCents: Math.max(0, Math.min(Math.round(C.total * 100), Math.round(parseNumber(B.deposit) * 100))) });
    return { data: { folio: out.data.number, id: out.data.id, warnings: out.warnings, owedCents: 0 } };
  }, {
    touches: ['sales', 'orders', 'stock', 'products', 'collections', 'customers', 'reports', 'home', 'purchases', 'printers', 'search'],
    ok: (out) => {
      const warn = out.warnings.map((w) => t(`warnings.${w.code}`, w.details ?? {}));
      if (!B.order) return [t('toast.sale.created', { count: C.useN }), out.owedCents > 0 ? t('screens.builder.owedAfterSale', { amount: moneyTotal(out.owedCents / 100) }) : '', ...warn].filter(Boolean).join(' ');
      if (edit) return [t('toast.order.updated', { folio: out.folio }), ...warn].join(' ');
      return [t('toast.order.created', { folio: out.folio }), C.useN && B.accepted ? t('toast.order.created.reserved', { count: C.useN }) : '', ...warn].filter(Boolean).join(' ');
    },
    onDone: (out) => go(!B.order ? '/ventas' : edit ? `/pedidos/pedido?id=${out.id}` : '/pedidos'),
  });
  const submit = () => {
    if (!C.rows.length) { toast(es.errors.LINE_ITEMS_REQUIRED); return; }
    if (B.order && !customer) { toast(es.errors.CUSTOMER_REQUIRED); document.querySelector<HTMLSelectElement>('[data-b=cliente]')?.focus(); return; }
    if (!B.order && C.printN > 0) { toast(es.errors.INSUFFICIENT_STOCK); return; }
    save.mutate(undefined);
  };

  const title = edit ? t('screens.builder.titleEdit', { folio: edit.number }) : B.order ? L.titleOrder : L.titleSale;
  const sorted = [...customers].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const saveLabel = edit ? L.saveEdit : B.order ? L.saveOrder : L.saveSale;
  const totalShown = focus.total ?? (C.rows.length ? fmtNum(C.total) : '');
  const gPctShown = focus.gPct ?? (C.rows.length ? fmtNum(B.gPct) : '');
  return (
    <>
      <nav className="crumbs"><a href={back} onClick={(e) => { e.preventDefault(); go(B.order ? '/pedidos' : '/ventas'); }}>{B.order ? L.orders : L.sales}</a><span>/</span><span>{title}</span></nav>
      <header className="ph"><div><h1>{title}</h1><p className="sub">{B.order ? L.subOrder : L.subSale}</p></div><div className="ph-a" /></header>
      <div className="ed">
        <div className="ed-form">
          <fieldset className="blk">
            <legend>{B.order ? L.legendOrder : L.legendSale}</legend>
            <div className="grid3">
              <div>
                <label className="fld"><span>{L.customer}</span>
                  <select data-b="cliente" value={B.customerId} onChange={(e) => { if (e.target.value === NEW) setCreating('new'); else set({ customerId: e.target.value }); }}>
                    <option value="">{B.order ? L.chooseCustomer : L.walkIn}</option>
                    {sorted.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    <option value={NEW}>{L.newCustomer}</option>
                  </select>
                </label>
                <p className="cli-mini" id="b-cli-info">
                  {customer ? <>{customer.type} · {customer.phone || <b className="neg">{L.infoNoContact}</b>}{customer.hasLogo ? ` · ${L.infoWithLogo}` : ''} · <button type="button" className="link" onClick={() => setCreating('edit')}>{es.common.edit}</button></> : B.order ? L.infoNeedsCustomer : L.infoWalkIn}
                </p>
              </div>
              {B.order
                ? <label className="fld"><span>{L.dueOn}</span><input type="date" data-b="entrega" value={B.dueOn} onChange={(e) => set({ dueOn: e.target.value })} /></label>
                : <label className="fld"><span>{L.date}</span><input type="date" data-b="fecha" value={B.on} max={today} onChange={(e) => set({ on: e.target.value })} /></label>}
              <label className="fld"><span>{L.channel}</span><select data-b="canal" value={B.channelId} onChange={(e) => set({ channelId: e.target.value })}>{channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>{B.order ? <small>{L.channelHint}</small> : null}</label>
              {!B.order ? <label className="fld"><span>{L.paidNow}</span><UnitInput unit="$" data-b="cobrado" inputMode="decimal" value={B.paidNow} placeholder={L.paidNowPlaceholder} onChange={(e) => set({ paidNow: e.target.value })} /><small>{L.paidNowHint}</small></label> : null}
              {B.order && !edit ? <label className="fld"><span>{L.deposit}</span><UnitInput unit="$" data-b="anticipo" inputMode="decimal" value={B.deposit} placeholder="0" onChange={(e) => set({ deposit: e.target.value })} /><small>{L.depositHint}</small></label> : null}
            </div>
            <div className="mt"><label className="fld"><span>{L.note}</span><input data-b="nota" value={B.note} placeholder={B.order ? L.notePlaceholderOrder : L.notePlaceholderSale} onChange={(e) => set({ note: e.target.value })} /></label></div>
            {B.order && !edit ? <label className="chk mt"><input type="checkbox" data-b="acept" checked={B.accepted} onChange={(e) => set({ accepted: e.target.checked })} /><span>{L.accepted}</span><small>{L.acceptedHint}</small></label> : null}
          </fieldset>
          <fieldset className="blk">
            <legend>{L.items}</legend>
            <label className="search wide"><span className="sr">{L.search}</span><input data-b="q" type="search" placeholder={L.search} value={B.q} onChange={(e) => set({ q: e.target.value })} /></label>
            <div className="pick" id="b-pick" aria-label={L.pickLabel}><Pick q={B.q} order={B.order} products={products} collections={collections} free={defs.free} onAdd={add} /></div>
            {B.order ? null : <p className="hint sx-out">{L.toOrderBefore}<button type="button" className="link" onClick={toOrder}>{L.toOrder}</button>{L.toOrderAfter}</p>}
            <div id="b-lines" className="lns" aria-live="polite">
              {C.rows.length ? C.rows.map((r) => (
                <LineView key={`${r.line.kind}-${r.line.id}-${r.i}`} r={r} defs={defs} order={B.order} gPct={B.gPct} byProduct={byProduct}
                  onChange={(patch) => setLine(r.i, patch)} onRemove={() => set({ lines: B.lines.filter((_, k) => k !== r.i) })}
                  onSplit={() => { set({ lines: B.lines.flatMap((l, k) => (k === r.i ? splitSet(l, defs) : [l])) }); toast(es.toast['builder.split']); }} />
              )) : <div className="ln-empty"><Mascot size={40} /><p>{L.emptyLines}</p></div>}
            </div>
          </fieldset>
          <div className="ed-mini b-bar" id="b-mini">
            <span>{L.miniTotal}<b>{moneyTotal(C.total)}</b></span>
            <span>{L.miniProfit}<b className={C.profit >= 0 ? 'pos' : 'neg'}>{C.rows.length ? moneyTotal(C.profit) : '—'}</b></span>
            <Button variant="primary" onClick={submit} busy={save.isPending}>{edit ? L.miniEdit : B.order ? L.miniOrder : L.miniSale}</Button>
          </div>
        </div>
        <aside className="ed-res" aria-label={L.summary}>
          <div className="res-top">
            <label className="price"><span className="k">{L.totalToCharge}</span><span className="unit big"><i className="pre">$</i>
              <input id="b-total" data-b="total" inputMode="decimal" placeholder="0" value={totalShown}
                onFocus={() => setFocus({ total: totalShown })} onBlur={() => setFocus({})}
                onChange={(e) => { setFocus({ total: e.target.value }); if (C.sub > 0 && e.target.value.trim() !== '') set({ gPct: (1 - Math.max(0, parseNumber(e.target.value)) / C.sub) * 100 }); }} /></span></label>
            <div className="gdesc"><label className="fld"><span>{L.discountAll}</span><UnitInput unit="%" id="b-gpct" data-b="gPct" inputMode="decimal" placeholder="0" value={gPctShown}
              onFocus={() => setFocus({ gPct: gPctShown })} onBlur={() => setFocus({})}
              onChange={(e) => { setFocus({ gPct: e.target.value }); set({ gPct: Math.min(100, parseNumber(e.target.value)) }); }} /></label></div>
          </div>
          <p className="hint" id="b-sub">
            {C.rows.length ? <>{rich(L.subSum, {}, { sum: <b>{money2d(C.sub)}</b> })}{C.discount > 0.005 ? rich(L.subDiscount, {}, { amount: <b>{money2d(C.discount)}</b> }) : C.discount < -0.005 ? rich(L.subSurcharge, {}, { amount: <b>{money2d(-C.discount)}</b> }) : null}{L.subTail}</> : null}
          </p>
          <div className="refs"><span className="k">{L.refsTitle}</span>
            <div id="b-refs">
              {C.rows.length ? (
                <>
                  <button type="button" className="ref" onClick={() => set({ gPct: 0 })}><b>{L.refList}</b><small>{L.refNoDiscount}</small></button>
                  {[5, 10, 15].map((x) => <button key={x} type="button" className="ref" onClick={() => set({ gPct: x })}><b>{`−${x}%`}</b><small>{moneyTotal(C.sub * (1 - x / 100))}</small></button>)}
                  <button type="button" className="ref" onClick={() => { if (C.sub > 0) set({ gPct: (1 - C.floor / C.sub) * 100 }); }}><b>{moneyTotal(Math.ceil(C.floor))}</b><small>{L.refFloor}</small></button>
                </>
              ) : <small>{L.refsEmpty}</small>}
            </div>
          </div>
          <div id="b-dyn"><Summary C={C} order={B.order} accepted={B.accepted} channelName={channel?.name ?? ''} deposit={!B.order || edit ? 0 : Math.min(C.total, parseNumber(B.deposit))} names={(id) => byProduct.get(id)?.displayName ?? ''} filaments={filaments} purgePct={settings.purgePct} onToOrder={toOrder} /></div>
          <div className="res-act">
            <Button variant="primary" block onClick={submit} busy={save.isPending} busyLabel={es.common.saving}>{saveLabel}</Button>
            <Button variant="ghost" block onClick={() => go(back)}>{L.discard}</Button>
          </div>
        </aside>
      </div>
      {creating === 'new' ? <CustomerDialog onClose={() => setCreating(null)} onSaved={(c) => { set({ customerId: c.id }); setCreating(null); }} /> : null}
      {creating === 'edit' && customer ? <CustomerDialog customer={customer} onClose={() => setCreating(null)} onSaved={() => setCreating(null)} /> : null}
    </>
  );
}

