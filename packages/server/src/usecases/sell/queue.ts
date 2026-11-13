// Print queues (docs/04 §7): one entry per printer and order, durations from the pieces that are printed.
import { itemHours, itemToPrint, jobMinutes, jobProgress, type LineItemData } from '@app/core';
import { deleteQueueEntries, insertQueueEntries, listOrders, listQueue, updateQueueEntry, type Ctx, type Executor, type LineItemRow, type OrderRow, type ProductFull } from '@app/db';
import { displayNames } from '../../views/costing';
import { groupBy, lineItemData } from './common';

/** "3 × Letrero, 10 × Servilletero": what is printed. */
export function printText(items: readonly LineItemData[], names: ReadonlyMap<string, string>) {
  const out = new Map<string, number>();
  for (const it of items) for (const [id, n] of Object.entries(itemToPrint(it))) out.set(id, (out.get(id) ?? 0) + n);
  return [...out].map(([id, n]) => `${n} × ${names.get(id) ?? ''}`).join(', ');
}

/** Adds the order to the end of each printer queue that got items; an empty queue starts now. */
export async function enqueue(tx: Executor, ctx: Ctx, o: OrderRow, items: readonly LineItemRow[], products: readonly ProductFull[], now: Date, nextId: () => string) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const names = displayNames(products);
  const groups = groupBy(items.filter((it) => it.printerId), (it) => it.printerId!);
  const current = groupBy(await listQueue(tx, ctx, { printerIds: [...groups.keys()], forUpdate: true }), (q) => q.printerId);
  const rows = [...groups].map(([printerId, its]) => {
    const data = its.map(lineItemData);
    const q = current.get(printerId) ?? [];
    return {
      id: nextId(), printerId, orderId: o.id, text: printText(data, names),
      minutes: jobMinutes(data.reduce((a, it) => a + itemHours(it, (id) => byId.get(id)?.hours ?? 0), 0)),
      position: q.length ? Math.max(...q.map((x) => x.position)) + 1 : 0, startedAt: q.length ? null : now,
    };
  });
  await insertQueueEntries(tx, ctx, rows);
}

/** Takes the order (or one entry) out of the queues; the job that follows starts now. */
export async function dequeue(tx: Executor, ctx: Ctx, f: { orderId?: string; id?: string }, now: Date) {
  const removed = await deleteQueueEntries(tx, ctx, f);
  const printers = [...new Set(removed.map((r) => r.printerId))];
  for (const q of groupBy(await listQueue(tx, ctx, { printerIds: printers, forUpdate: true }), (x) => x.printerId).values()) {
    if (q[0] && !q[0].startedAt) await updateQueueEntry(tx, ctx, q[0].id, { startedAt: now });
  }
  return removed;
}

/** Queues with progress, for Impresoras and the order page. Entries of deleted orders do not count. */
export async function queueViews(ex: Executor, ctx: Ctx, f: { printerIds?: readonly string[]; orderId?: string }, now: Date) {
  const rows = await listQueue(ex, ctx, f.orderId ? { orderId: f.orderId } : f.printerIds ? { printerIds: f.printerIds } : {});
  const orders = new Map((await listOrders(ex, ctx, { ids: [...new Set(rows.map((r) => r.orderId))] })).map((o) => [o.id, o]));
  const all = f.orderId ? await listQueue(ex, ctx, { printerIds: [...new Set(rows.map((r) => r.printerId))] }) : rows;
  const byPrinter = groupBy(all.filter((r) => orders.has(r.orderId) || !f.orderId), (r) => r.printerId);
  const out = new Map<string, { id: string; orderId: string; orderNumber: number; text: string; minutes: number; startedAt: string | null; remainingMinutes: number; progress: number; waitMinutes: number; position: number }[]>();
  for (const [printerId, q] of byPrinter) {
    let wait = 0;
    const list = q.map((e, pos) => {
      const p = jobProgress({ minutes: e.minutes, startedAt: e.startedAt }, now);
      const v = { id: e.id, orderId: e.orderId, orderNumber: orders.get(e.orderId)?.number ?? 0, text: e.text, minutes: e.minutes, startedAt: e.startedAt?.toISOString() ?? null, remainingMinutes: p.left, progress: p.pct, waitMinutes: pos === 0 ? 0 : wait, position: pos };
      wait += pos === 0 ? p.left : e.minutes;
      return v;
    });
    out.set(printerId, f.orderId ? list.filter((x) => x.orderId === f.orderId) : list);
  }
  return out;
}
