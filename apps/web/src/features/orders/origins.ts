// Where each piece of an order is (mockup itemDesglose/origenesDe): shelf, to print, printing, queued, ready, delivered.
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { queueDuration } from '../../lib/format';
import type { OrderStatus, PartRef } from './api';

export type OriginKind = 'stock' | 'todo' | 'print' | 'queue' | 'ok' | 'done' | 'warn';
export const ORIGIN_ORDER: OriginKind[] = ['stock', 'ok', 'print', 'queue', 'todo', 'warn', 'done'];
export interface Tag { k: OriginKind; n: number; s?: string; pct?: number }
export interface PieceRow { productId: string; name: string; qty: number; tags: Tag[] }
export interface ItemLike { kind: 'piece' | 'set'; productId: string | null; name: string; qty: number; parts: readonly PartRef[]; fromStock: Readonly<Record<string, number>>; printerId: string | null; printerName?: string | null }
export interface JobLike { printerId: string; printerName: string; progress: number; waitMinutes: number; position: number }

const L = es.screens.order;

/** Pieces that form an item: each part × sets, or the piece itself. */
export function pieceLines(it: ItemLike): { productId: string; name: string; qty: number }[] {
  if (it.kind === 'set' && it.parts.length) return it.parts.map((p) => ({ productId: p.productId, name: p.name, qty: p.qty * it.qty }));
  return [{ productId: it.productId ?? '', name: it.name, qty: it.qty }];
}

export function itemRows(it: ItemLike, status: OrderStatus, jobs: readonly JobLike[]): PieceRow[] {
  const pool: Record<string, number> = { ...it.fromStock };
  return pieceLines(it).map((l) => {
    const ex = Math.min(l.qty, Math.max(0, pool[l.productId] ?? 0));
    pool[l.productId] = Math.max(0, (pool[l.productId] ?? 0) - ex);
    const imp = l.qty - ex;
    const tags: Tag[] = [];
    if (status === 'delivered') tags.push({ k: 'done', n: l.qty });
    else if (status === 'ready') tags.push({ k: 'ok', n: l.qty, s: L.subReservedInStock });
    else {
      if (ex) tags.push({ k: 'stock', n: ex, s: status === 'quoted' ? L.subReserveOnAccept : L.subReserved });
      if (imp) {
        const j = status === 'in_production' ? jobs.find((x) => x.printerId === it.printerId) : undefined;
        if (status !== 'in_production') tags.push({ k: 'todo', n: imp });
        else if (j && j.position === 0) tags.push({ k: 'print', n: imp, s: t('screens.order.subPrinting', { printer: j.printerName, n: j.progress }), pct: j.progress });
        else if (j) tags.push({ k: 'queue', n: imp, s: t('screens.order.subQueued', { printer: j.printerName, time: queueDuration(j.waitMinutes) }) });
        else if (it.printerId) tags.push({ k: 'ok', n: imp, s: it.printerName ? t('screens.order.subPrintedIn', { printer: it.printerName }) : L.subPrinted });
        else tags.push({ k: 'warn', n: imp, s: L.subUnassigned });
      }
    }
    return { ...l, tags };
  });
}

export type Count = Partial<Record<OriginKind, number>>;
export const countTags = (rows: readonly PieceRow[]): Count => rows.reduce<Count>((a, r) => { for (const tg of r.tags) a[tg.k] = (a[tg.k] ?? 0) + tg.n; return a; }, {});
export const sumCounts = (cs: readonly Count[]): Count => cs.reduce<Count>((a, c) => { for (const [k, n] of Object.entries(c)) a[k as OriginKind] = (a[k as OriginKind] ?? 0) + (n ?? 0); return a; }, {});

/** Pieces grouped by place, in the mockup order: [{k, n, pz: {name: n}}]. */
export function originsOf(rows: readonly PieceRow[]) {
  const o: Partial<Record<OriginKind, { k: OriginKind; n: number; pz: Record<string, number> }>> = {};
  for (const r of rows) for (const tg of r.tags) { const x = (o[tg.k] ??= { k: tg.k, n: 0, pz: {} }); x.n += tg.n; x.pz[r.name] = (x.pz[r.name] ?? 0) + tg.n; }
  return ORIGIN_ORDER.filter((k) => o[k]).map((k) => o[k]!);
}

/** "Lista"/"Listas", "Entregada"/"Entregadas". */
export function originLabel(k: OriginKind, n: number): string {
  const O = es.screens.orders.origin;
  if (k === 'ok') return n > 1 ? O.okMany : O.ok;
  if (k === 'done') return n > 1 ? O.doneMany : O.done;
  return O[k];
}
export const countText = (c: Count) => ORIGIN_ORDER.filter((k) => (c[k] ?? 0) > 0).map((k) => `${c[k]} ${originLabel(k, c[k]!).toLowerCase()}`).join(' · ');
