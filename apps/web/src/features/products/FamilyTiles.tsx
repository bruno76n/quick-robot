// Productos › Fichas by families (mejoras/ronda-2.md §3.2) in ronda-3 style (reference/ronda-3/productos.html .prod):
// a tile per original; "N variantes" opens one panel at a time, full width under the tile's row.
import type { ProductFamily } from '@app/contract';
import { stockStatus } from '@app/core';
import { Fragment, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Button } from '../../components/Button';
import { Swatch } from '../../components/Pill';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { centsTotal, hours, money, number1 } from '../../lib/format';
import { PieceThumb } from '../../components/PieceThumb';
import { go } from '../../lib/nav';
import { newVariantPath, sellPath } from './api';

const L = es.screens.products;
export const openPiece = (id: string) => go(`/productos/pieza?id=${id}`);
export const ratio = (price: number, cost: number) => `×${number1(cost ? price / cost : 0)}`;
export const printerOf = (p: { printerName: string | null; printerId: string | null }) => p.printerName ?? (p.printerId ? '' : L.anyPrinter);

export function Chevron({ dir = 'down' }: { dir?: 'down' | 'right' }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={dir === 'down' ? 'm6 9 6 6 6-6' : 'm9 6 6 6-6 6'} /></svg>;
}

/** Stock line of a tile (mockup .prod-f): "Disponibles: N" (amber when only one or two), "Apartado", "Sin existencias" or "Solo por pedido". */
export function stockState(p: { tracksStock: boolean; free: number; physical: number; reserved: number }) {
  if (!p.tracksStock) return <span className="meta">{L.onlyToOrder}</span>;
  const st = stockStatus(p.physical, p.reserved);
  if (st === 'out') return <span className="meta">{L.noStock}</span>;
  if (st === 'all_reserved') return <span className="pill">{es.status.stock.all_reserved}</span>;
  return <span className={`pill ${st === 'few' ? 'warn' : 'good'}`}>{t('screens.products.freeShort', { count: p.free })}</span>;
}

/** One member of a family as a row (the panel and the list share it). */
export interface Member {
  id: string; label: string; original: boolean; hexes: string[]; material: string | null; costCents: number; listCents: number;
  tracksStock: boolean; free: number; physical: number; reserved: number; sold: number;
}
export const membersOf = (f: ProductFamily, withOriginal: boolean): Member[] => [
  ...(withOriginal ? [{ id: f.id, label: f.name, original: true, hexes: f.hexes, material: f.material, costCents: f.costCents, listCents: f.listCents, tracksStock: f.tracksStock, free: f.free, physical: f.physical, reserved: f.reserved, sold: f.sold }] : []),
  ...f.variants.map((v) => ({ id: v.id, label: v.label, original: false, hexes: v.hexes, material: v.material, costCents: v.costCents, listCents: v.listCents, tracksStock: v.tracksStock, free: v.free, physical: v.physical, reserved: v.reserved, sold: v.soldCount })),
];
export function MemberStock({ m, unit }: { m: Member; unit: boolean }) {
  if (!m.tracksStock) return <><span className="mut">—</span><small className="blk">{L.onlyToOrderLower}</small></>;
  const apt = Math.min(m.physical, m.reserved);
  return <><b>{unit ? t('screens.products.free', { count: m.free }) : m.free}</b><small className="blk">{t('screens.products.reserved', { count: apt })}</small></>;
}

/** Columns that fit in the grid right now (4 → 2 → 1 with the width), to place the panel under the tile's row. */
function useColumns(): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(4);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const read = () => setCols(Math.max(1, getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length));
    read();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, cols];
}

export function FamilyTiles({ items, open, onToggle, empty }: { items: ProductFamily[]; open: string | null; onToggle: (id: string) => void; empty: ReactNode }) {
  const [ref, cols] = useColumns();
  const idx = items.findIndex((f) => f.id === open && f.variantCount > 0);
  const rowEnd = idx < 0 ? -1 : Math.min(items.length - 1, Math.floor(idx / cols) * cols + cols - 1);
  return (
    <div className="pt-grid fam" ref={ref}>
      {items.map((f, i) => (
        <Fragment key={f.id}>
          <FamilyTile p={f} isOpen={i === idx} onToggle={onToggle} />
          {i === rowEnd ? <VariantsPanel f={items[idx]!} notch={((idx % cols) + 0.5) / cols} /> : null}
        </Fragment>
      ))}
      {!items.length ? empty : null}
    </div>
  );
}

function FamilyTile({ p, isOpen, onToggle }: { p: ProductFamily; isOpen: boolean; onToggle: (id: string) => void }) {
  return (
    <article className={`pt${isOpen ? ' on' : ''}`} tabIndex={0} onClick={() => openPiece(p.id)} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) openPiece(p.id); }} data-testid="product-tile">
      <div className="pt-top"><PieceThumb photoUrl={p.photoUrl} hexes={p.hexes} shape="wide" />{p.technical ? <span className="pt-tags"><span className="pill">{L.technicalTag}</span></span> : null}</div>
      <div className="pt-b">
        <div className="pt-n">{p.name}</div><small className="pt-s">{metaOf(p)}</small>
        <Figures price={p.listCents} cost={p.costCents} />
        <div className="pt-st">{stockState(p)}
          {p.variantCount ? <button type="button" className="vpill" aria-expanded={isOpen} data-testid="variants-toggle" onClick={(e) => { e.stopPropagation(); onToggle(p.id); }} onKeyDown={(e) => e.stopPropagation()}>{t('screens.products.variants.count', { count: p.variantCount })}<Chevron /></button> : null}
        </div>
      </div>
      <div className="pt-a" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <Button size="sm" onClick={() => go(sellPath(p.id, p.free))}>{p.free > 0 ? L.sell : L.order}</Button>
        <Button size="sm" variant="ghost" icon="plus" onClick={() => go(newVariantPath(p.id))}>{L.variants.add}</Button>
      </div>
    </article>
  );
}

/** Print time as the mockup writes it: "25 min", "4 h", "2 h 30 min". */
const duration = (h: number) => (h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : hours(h));

/** "material · time" under the name (mockup .prod-b .ui-meta); the printer when there is no material. */
const metaOf = (p: ProductFamily) => [p.material ?? printerOf(p), p.hours > 0 ? duration(p.hours) : ''].filter(Boolean).join(' · ');

/** Price · Cost · Profit in three columns (mockup .prod-k); profit in green, a loss in red. */
export function Figures({ price, cost, priceLabel = L.colPrice }: { price: number; cost: number; priceLabel?: string }) {
  const gain = price - cost;
  return (
    <dl className="pt-k">
      <div><dt>{priceLabel}</dt>{' '}<dd className="num">{centsTotal(price)}</dd></div>
      <div><dt>{L.colCost}</dt>{' '}<dd className="num">{money(cost / 100)}</dd></div>
      <div className={gain >= 0 ? 'g' : 'l'}><dt>{L.colProfit}</dt>{' '}<dd className="num">{money(gain / 100)}</dd></div>
    </dl>
  );
}

export function VariantsPanel({ f, notch }: { f: ProductFamily; notch: number }) {
  return (
    <section className="vpanel" style={{ ['--notch' as string]: `${notch * 100}%` }} aria-label={t('screens.products.variants.panelTitle', { name: f.name })} data-testid="variants-panel">
      <div className="vp-h">
        <b>{t('screens.products.variants.panelTitle', { name: f.name })}</b>
        <Button size="sm" icon="plus" onClick={() => go(newVariantPath(f.id))}>{L.variants.new}</Button>
      </div>
      <div className="vp-t" role="table">
        <div className="vp-r vp-hd" role="row"><span role="columnheader">{L.colVariant}</span><span role="columnheader">{L.colMaterial}</span><span role="columnheader" className="r">{L.colCost}</span><span role="columnheader" className="r">{L.colPrice}</span><span role="columnheader" className="r">{L.colProfit}</span><span role="columnheader" className="r">{L.colInStock}</span><span role="columnheader" className="r">{L.colSold}</span><span role="columnheader"><span className="sr">{es.common.detail}</span></span></div>
        {membersOf(f, true).map((m) => {
          const gain = m.listCents - m.costCents;
          return (
            <div key={m.id} className="vp-r" role="row" data-testid="variant-row">
              <span role="cell" className="vp-n"><Swatch hex={m.hexes[0] ?? 'var(--no-color)'} /><b>{m.label}</b>{m.original ? <span className="pill">{L.variants.original}</span> : null}</span>
              <span role="cell" className="vp-m">{m.material ?? '—'}</span>
              <span role="cell" className="r num cost vp-c" data-k={L.colCost}>{money(m.costCents / 100)}</span>
              <span role="cell" className="r num vp-p" data-k={L.colPrice}><b>{centsTotal(m.listCents)}</b></span>
              <span role="cell" className={`r num vp-g ${gain >= 0 ? 'pos' : 'neg'}`} data-k={L.colProfit}>{centsTotal(gain)}</span>
              <span role="cell" className="r num vp-s"><MemberStock m={m} unit /></span>
              <span role="cell" className="r num vp-v" data-k={L.colSold}>{number1(m.sold)}</span>
              <span role="cell" className="vp-a"><Button size="sm" onClick={() => go(sellPath(m.id, m.free))}>{m.free > 0 ? L.sell : L.order}</Button><Button size="sm" variant="ghost" onClick={() => openPiece(m.id)}>{es.common.edit}</Button></span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
