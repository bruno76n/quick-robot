// Shared pieces of the phase 3 use cases: the stock state, the photo of the moment of a line item,
// and conversions from rows to the shapes core computes with.
import { BusinessError, type LineItemInput } from '@app/contract';
import { free as freeOf, itemNeed, physical, reserved, setCost, setPrice, type LineItemData, type OrderStatus, type OrderStockView, type SaleData } from '@app/core';
import {
  getCollection, listCollections, listLineItems, listOrders, listPayments, listProducts, physicalStock,
  type Ctx, type Executor, type LineItemRow, type OrderRow, type PaymentRow, type ProductFull, type SaleFact, type SaleRow,
} from '@app/db';
import { costOf, displayNames, loadCostingContext, priceOf, setPartsOf, supplyIdsOf } from '../../views/costing';
import { notFound } from '../../http';

export const ACTIVE: readonly OrderStatus[] = ['quoted', 'accepted', 'in_production', 'ready'];
export const RESERVING: readonly OrderStatus[] = ['accepted', 'in_production', 'ready'];

export function lineItemData(r: LineItemRow): LineItemData {
  return {
    kind: r.kind as 'piece' | 'set', productId: r.productId, collectionId: r.collectionId, name: r.name, qty: r.qty,
    price: r.priceCents / 100, list: r.listCents / 100, cost: r.costCents / 100, extras: r.extrasCents / 100,
    parts: (r.parts ?? []).map((p) => ({ productId: p.productId, name: p.name, qty: p.qty, list: p.listCents / 100, cost: p.costCents / 100 })),
    ...(r.fromStock ? { fromStock: r.fromStock } : {}),
  };
}

export const groupBy = <T, K>(rows: readonly T[], key: (r: T) => K) => {
  const m = new Map<K, T[]>();
  for (const r of rows) m.set(key(r), [...(m.get(key(r)) ?? []), r]);
  return m;
};

// ---------- Stock state ----------
export interface StockState {
  physical: Map<string, number>;
  tracks: Map<string, boolean>;
  orders: (OrderStockView & { number: number })[];
  reserved(productId: string, exceptOrderId?: string): number;
  free(productId: string, exceptOrderId?: string): number;
}

/** Physical per piece (ledger), and the orders that reserve pieces (docs/04 §5). */
export async function loadStock(ex: Executor, ctx: Ctx, products?: readonly ProductFull[]): Promise<StockState> {
  const list = products ?? await listProducts(ex, ctx);
  const ph = await physicalStock(ex, ctx);
  const orders = await listOrders(ex, ctx, { statuses: RESERVING });
  const items = groupBy(await listLineItems(ex, ctx, 'order', orders.map((o) => o.id)), (r) => r.parentId);
  const views = orders.map((o) => ({ id: o.id, number: o.number, status: o.status as OrderStatus, items: (items.get(o.id) ?? []).map(lineItemData), reserved: o.stockReserved }));
  const tracks = new Map(list.map((p) => [p.id, p.tracksStock]));
  const res = (id: string, except?: string) => (tracks.get(id) ? reserved(id, views, except) : 0);
  return {
    physical: ph, tracks, orders: views, reserved: res,
    free: (id, except) => (tracks.get(id) ? freeOf(physical([ph.get(id) ?? 0]), res(id, except)) : 0),
  };
}

/** INSUFFICIENT_STOCK when a sale needs more free pieces than there are. */
export function assertStock(need: Record<string, number>, st: StockState, names: Map<string, string>) {
  const short = Object.entries(need).filter(([id, n]) => st.tracks.get(id) && n > st.free(id))
    .map(([id, n]) => ({ productId: id, name: names.get(id) ?? '', requested: n, free: st.free(id) }));
  if (short.length) throw new BusinessError('INSUFFICIENT_STOCK', { items: short, productId: short[0]!.productId, name: short[0]!.name, requested: short[0]!.requested, free: short[0]!.free });
}

export function needOf(items: readonly LineItemData[]) {
  const out: Record<string, number> = {};
  for (const it of items) for (const [id, n] of Object.entries(itemNeed(it))) out[id] = (out[id] ?? 0) + n;
  return out;
}

// ---------- Photo of the moment ----------
export type NewItem = Omit<LineItemRow, 'workspaceId' | 'createdAt' | 'updatedAt' | 'parentKind' | 'parentId'>;

/** Builds the frozen line items from what the interface sent; costs and list prices come from the server (docs/12 §3). */
export async function buildItems(ex: Executor, ctx: Ctx, inputs: readonly LineItemInput[], nextId: () => string, opts: { keepFromStock: boolean }): Promise<NewItem[]> {
  if (!inputs.length) throw new BusinessError('LINE_ITEMS_REQUIRED');
  const products = await listProducts(ex, ctx);
  const byId = new Map(products.map((p) => [p.id, p]));
  const names = displayNames(products);
  const c = await loadCostingContext(ex, ctx, supplyIdsOf(products));
  const cols = new Map((await listCollections(ex, ctx)).map((x) => [x.id, x]));
  return Promise.all(inputs.map(async (it, position): Promise<NewItem> => {
    const base = { id: nextId(), position, qty: it.qty, priceCents: it.priceCents, printerId: null };
    if (it.kind === 'piece') {
      const p = byId.get(it.productId!);
      if (!p) throw notFound('product');
      const total = costOf(p, c).total;
      const fromStock = opts.keepFromStock && it.fromStock?.[p.id] ? { [p.id]: Math.min(it.qty, it.fromStock[p.id]!) } : null;
      return { ...base, kind: 'piece', productId: p.id, collectionId: null, name: names.get(p.id) ?? p.name, listCents: Math.round(priceOf(p, c, total) * 100), costCents: total * 100, extrasCents: 0, parts: null, fromStock };
    }
    const col = cols.get(it.collectionId!) ?? await getCollection(ex, ctx, it.collectionId!);
    if (!col) throw notFound('collection');
    const parts = setPartsOf(col, byId, c);
    let fromStock: Record<string, number> | null = null;
    if (opts.keepFromStock && it.fromStock) {
      const need: Record<string, number> = {};
      for (const p of parts) need[p.productId] = (need[p.productId] ?? 0) + p.qty * it.qty;
      const fs = Object.fromEntries(Object.entries(it.fromStock).filter(([id, n]) => need[id] && n > 0).map(([id, n]) => [id, Math.min(n, need[id]!)]));
      fromStock = Object.keys(fs).length ? fs : null;
    }
    return {
      ...base, kind: 'set', productId: null, collectionId: col.id, name: col.name,
      listCents: Math.round(setPrice(col.priceCents === null ? null : col.priceCents / 100, parts) * 100),
      costCents: setCost(parts, col.extrasCents / 100) * 100, extrasCents: col.extrasCents,
      parts: parts.map((p) => ({ productId: p.productId, name: p.name, qty: p.qty, listCents: Math.round(p.listPrice * 100), costCents: p.cost * 100 })), fromStock,
    };
  }));
}

// ---------- Sales and orders as core data ----------
export const commissionOf = (channels: readonly { id: string; commissionPct: number }[], id: string) => channels.find((x) => x.id === id)?.commissionPct ?? 0;

export function saleData(s: SaleRow, items: readonly LineItemRow[], payments: readonly PaymentRow[], commissionPct: number): SaleData & { on: string; channelId: string } {
  return {
    id: s.id, on: s.on, channelId: s.channelId, items: items.map(lineItemData), commissionPct,
    payments: s.tracksPayments ? payments.map((p) => p.amountCents / 100) : null,
    returned: s.return ? { on: s.return.on, restock: s.return.restock, refund: s.return.refundCents / 100, note: s.return.note } : null,
  };
}

export function orderData(o: OrderRow, items: readonly LineItemRow[], payments: readonly PaymentRow[], commissionPct: number) {
  return { status: o.status as OrderStatus, items: items.map(lineItemData), commissionPct, payments: payments.map((p) => p.amountCents / 100), createdOn: o.createdOn, dueOn: o.dueOn };
}

/** Items and payments of many sales or orders in two queries. */
export async function childrenOf(ex: Executor, ctx: Ctx, kind: 'sale' | 'order', ids: readonly string[]) {
  const items = groupBy(await listLineItems(ex, ctx, kind, ids), (r) => r.parentId);
  const payments = groupBy(await listPayments(ex, ctx, kind, ids), (r) => r.parentId);
  return { items: (id: string) => items.get(id) ?? [], payments: (id: string) => payments.get(id) ?? [] };
}

/** Short text of the items: "2 × Llavero, 1 × Set". */
export const itemsText = (items: readonly { qty: number; name: string }[]) => items.map((i) => `${i.qty} × ${i.name}`).join(', ');
export const cents = (pesos: number) => Math.round(Math.round((pesos + Number.EPSILON) * 100) / 100 * 100);

/** A sale's sums as core data: one synthetic line with the totals (same income, commission, cost, profit and owed). */
export function factSale(f: SaleFact, commissionPct: number): SaleData {
  return {
    id: f.id, commissionPct, payments: f.tracksPayments ? [f.paidCents / 100] : null,
    items: [{ kind: 'piece', productId: null, name: '', qty: 1, price: f.grossCents / 100, list: f.listCents / 100, cost: f.costCents / 100 }],
    returned: f.return ? { on: f.return.on, restock: f.return.restock, refund: f.return.refundCents / 100, note: f.return.note } : null,
  };
}
