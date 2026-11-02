// Orders (docs/04 §7): totals, payment, states, next step, and what marking ready and delivering write.
import { round2 } from './money';
import { itemCost, itemNeed, itemPieces, itemToPrintCount, itemTotal, type LineItemData } from './line-items';
import type { OrderStatus } from './stock';

export const ORDER_FLOW: readonly OrderStatus[] = ['quoted', 'accepted', 'in_production', 'ready', 'delivered'];

export interface OrderData { status: OrderStatus; items: readonly LineItemData[]; commissionPct: number; payments: readonly number[] }

export const orderTotal = (o: Pick<OrderData, 'items'>) => o.items.reduce((a, it) => a + itemTotal(it), 0);
export const orderCost = (o: Pick<OrderData, 'items'>) => o.items.reduce((a, it) => a + itemCost(it), 0);
export const orderCommission = (o: OrderData) => (orderTotal(o) * o.commissionPct) / 100;
export const orderProfit = (o: OrderData) => orderTotal(o) - orderCommission(o) - orderCost(o);
export const orderPaid = (o: Pick<OrderData, 'payments'>) => o.payments.reduce((a, x) => a + x, 0);
/** Owed: 0 if cancelled; otherwise max(0, total − paid) (case 7.1). */
export const orderOwed = (o: OrderData) => (o.status === 'cancelled' ? 0 : Math.max(0, round2(orderTotal(o) - orderPaid(o))));
export const orderPieces = (o: Pick<OrderData, 'items'>) => o.items.reduce((a, it) => a + itemPieces(it), 0);
export const orderToPrint = (o: Pick<OrderData, 'items'>) => o.items.reduce((a, it) => a + itemToPrintCount(it), 0);
export const isActive = (s: OrderStatus) => s !== 'delivered' && s !== 'cancelled';

export type OrderStep = 'accept' | 'start_production' | 'ready' | 'deliver';
/** The next step of the order; "accepted" with nothing to print goes straight to ready (shortcut of §7). */
export function nextStep(o: Pick<OrderData, 'status' | 'items'>): OrderStep | null {
  switch (o.status) {
    case 'quoted': return 'accept';
    case 'accepted': return o.items.length && orderToPrint(o) === 0 ? 'ready' : 'start_production';
    case 'in_production': return 'ready';
    case 'ready': return 'deliver';
    default: return null;
  }
}

/** States from which a transition is valid (ORDER_INVALID_STATE otherwise). */
export function allowedFrom(step: OrderStep | 'cancel' | 'reassign', o: Pick<OrderData, 'status' | 'items'>): OrderStatus[] {
  switch (step) {
    case 'accept': return ['quoted'];
    case 'start_production': return ['accepted'];
    case 'reassign': return ['in_production'];
    case 'ready': return orderToPrint(o) === 0 ? ['accepted', 'in_production'] : ['in_production'];
    case 'deliver': return ['ready'];
    case 'cancel': return ['quoted', 'accepted', 'in_production', 'ready'];
  }
}

/**
 * Marking ready: every needed piece that tracks stock stays reserved (stk), and the printed ones enter stock as
 * "order_print" (case 7.2: 10 needed, 4 from the shelf → reserved 10, +6).
 */
export function planReady(items: readonly LineItemData[], tracksStock: (productId: string) => boolean) {
  const need: Record<string, number> = {};
  for (const it of items) for (const [id, n] of Object.entries(itemNeed(it))) need[id] = (need[id] ?? 0) + n;
  const reserved: Record<string, number> = {};
  const movements: { productId: string; qty: number }[] = [];
  for (const [id, n] of Object.entries(need)) {
    if (!tracksStock(id)) continue;
    reserved[id] = n;
    const fromShelf = items.reduce((a, it) => a + (it.fromStock?.[id] ?? 0), 0);
    const printed = n - Math.min(n, fromShelf);
    if (printed) movements.push({ productId: id, qty: printed });
  }
  return { reserved, movements };
}

/** Delivering takes the reserved pieces out of stock (case 7.2: −10). */
export const planDelivery = (reserved: Readonly<Record<string, number>>) => Object.entries(reserved).filter(([, n]) => n > 0).map(([productId, n]) => ({ productId, qty: -n }));
