// Finished pieces (docs/04 §5) and the purchase list (docs/04 §9). Never "there are 7": it is summed.
import type { LineItemData } from './line-items';
import { itemNeed } from './line-items';

export type StockMovementKind = 'initial' | 'print' | 'order_print' | 'sale' | 'return' | 'delivery' | 'adjustment';
export type StockStatus = 'out' | 'all_reserved' | 'few' | 'ok';
export type OrderStatus = 'quoted' | 'accepted' | 'in_production' | 'ready' | 'delivered' | 'cancelled';

export interface OrderStockView { id: string; status: OrderStatus; items: readonly LineItemData[]; reserved?: Readonly<Record<string, number>> | null }

export const physical = (movementQtys: readonly number[]) => Math.max(0, movementQtys.reduce((a, b) => a + b, 0));

/** How many of a piece an order took from the shelf (its items' fromStock). */
export const orderFromStock = (o: OrderStockView, productId: string) => o.items.reduce((a, it) => a + (it.fromStock?.[productId] ?? 0), 0);

/**
 * Reserved: accepted or in production → what each order chose to take from the shelf; ready → what was left
 * reserved (stk). Quoted, delivered and cancelled do not count (case 5.1).
 */
export function reserved(productId: string, orders: readonly OrderStockView[], exceptOrderId?: string): number {
  return orders.reduce((a, o) => {
    if (o.id === exceptOrderId) return a;
    if (o.status === 'accepted' || o.status === 'in_production') return a + orderFromStock(o, productId);
    if (o.status === 'ready') return a + (o.reserved?.[productId] ?? 0);
    return a;
  }, 0);
}

export const free = (physicalQty: number, reservedQty: number) => Math.max(0, physicalQty - reservedQty);

/** Status of a piece in Existencias (case 5.2). */
export function stockStatus(physicalQty: number, reservedQty: number): StockStatus {
  if (physicalQty <= 0) return 'out';
  const f = free(physicalQty, reservedQty);
  if (f === 0) return 'all_reserved';
  if (f <= 2) return 'few';
  return 'ok';
}

/**
 * Status of a family of variants (case 5.3): its numbers are the sum of its members. Out if every member is out;
 * all reserved if the free sum is 0; few if any member has 2 free or less; ok otherwise. One member → case 5.2.
 */
export function familyStockStatus(members: readonly { physical: number; reserved: number }[]): StockStatus {
  if (members.length === 1) return stockStatus(members[0]!.physical, members[0]!.reserved);
  if (members.every((m) => m.physical <= 0)) return 'out';
  if (members.reduce((a, m) => a + free(m.physical, m.reserved), 0) === 0) return 'all_reserved';
  if (members.some((m) => free(m.physical, m.reserved) <= 2)) return 'few';
  return 'ok';
}

/** Sets that can be built today: min over the parts of floor(free / needed); 0 if a part does not track stock. */
export function buildableSets(parts: readonly { productId: string; qty: number }[], freeOf: (productId: string) => number | null): number {
  const need: Record<string, number> = {};
  for (const p of parts) need[p.productId] = (need[p.productId] ?? 0) + Math.max(1, Math.round(p.qty));
  const ids = Object.keys(need);
  if (!ids.length) return 0;
  return Math.min(...ids.map((id) => { const f = freeOf(id); return f === null ? 0 : Math.floor(f / need[id]!); }));
}

/**
 * Accepting an order reserves the planned pieces; if they do not reach, it takes what there is and the rest is
 * printed. Returns the new fromStock per item and how many were missing (docs/04 §5).
 */
export function reserveForOrder(items: readonly LineItemData[], freeOf: (productId: string) => number): { fromStock: (Record<string, number> | undefined)[]; missing: number } {
  const left: Record<string, number> = {};
  let missing = 0;
  const fromStock = items.map((it) => {
    if (!it.fromStock) return undefined;
    const out: Record<string, number> = {};
    for (const [id, want] of Object.entries(it.fromStock)) {
      if (!(id in left)) left[id] = Math.max(0, freeOf(id));
      const take = Math.min(want, left[id]!);
      missing += want - take;
      left[id] = left[id]! - take;
      if (take > 0) out[id] = take;
    }
    return Object.keys(out).length ? out : undefined;
  });
  return { fromStock, missing };
}

/** Needs of a whole order per piece. */
export function orderNeed(items: readonly LineItemData[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const it of items) for (const [id, n] of Object.entries(itemNeed(it))) out[id] = (out[id] ?? 0) + n;
  return out;
}

// ---------- Compras (docs/04 §9) ----------
export interface PurchaseLine { kind: 'filament' | 'supply'; id: string; qty: number; estimated: number; supplierId: string | null; reason: 'order' | 'low' }

/** Supply enters the list if stock ≤ minimum: qty = ceil(2 × minimum − stock), at least 1 (case 9.1). */
export function supplyPurchase(s: { id: string; stock: number; minimum: number; unitCost: number; supplierId: string | null }): PurchaseLine | null {
  if (s.stock > s.minimum) return null;
  const qty = Math.max(1, Math.ceil(2 * s.minimum - s.stock));
  return { kind: 'supply', id: s.id, qty, estimated: qty * s.unitCost, supplierId: s.supplierId, reason: 'low' };
}

/**
 * Filament enters if an accepted order that has not deducted filament needs more than there is, or if it has spools
 * and 300 g or less are left. Qty = ceil(missing / grams of the last spool), at least 1 spool.
 */
export function filamentPurchase(f: { id: string; hasSpools: boolean; remaining: number; neededByOrders: number; lastSpool: { grams: number; costPlusShipping: number } | null; supplierId: string | null }): PurchaseLine | null {
  const missing = Math.max(0, f.neededByOrders - f.remaining);
  const low = f.hasSpools && f.remaining <= 300;
  if (!missing && !low) return null;
  const size = f.lastSpool?.grams || 1000;
  const qty = Math.max(1, Math.ceil(missing / size));
  return { kind: 'filament', id: f.id, qty, estimated: qty * (f.lastSpool?.costPlusShipping ?? 0), supplierId: f.supplierId, reason: missing ? 'order' : 'low' };
}
