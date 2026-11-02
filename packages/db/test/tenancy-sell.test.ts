// Isolation for the phase 3 tables: stock, customers, orders, sales, items, payments, print runs and queues.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Connection } from '../src/connect';
import type { Ctx } from '../src/ctx';
import {
  deleteLedgerRowsOfPrintRun, deletePayment, deletePrintRun, deleteQueueEntries, findCustomerByKey, getCustomer, getExpense, getOrder, getPrintRun, getSale,
  insertCustomer, insertLineItems, insertOrder, insertPayments, insertPrintRun, insertPrintRunFilaments, insertQueueEntries, insertSale, insertStockMovements,
  listCustomers, listExpenses, listLineItems, listOrders, listPayments, listPrintRunFilaments, listPrintRuns, listQueue, listSales, listStockMovements,
  nextOrderNumber, physicalStock, setCustomerDeleted, setOrderDeleted, setSaleDeleted, updateCustomer, updateLineItem, updateOrder, updateQueueEntry, updateSale, usageOf,
} from '../src/repos/sell-repo';
import { openTestDb } from '../src/testing';
import { twoWorkspaces, uid, type WsData } from './fixtures';

interface SellData { customerId: string; orderId: string; saleId: string; itemId: string; paymentId: string; runId: string; queueId: string }
async function sellData(conn: Connection, w: WsData, tag: number): Promise<SellData> {
  const db = conn.db;
  const ctx = w.ctx;
  await insertStockMovements(db, ctx, [{ id: uid(tag), productId: w.productId, on: '2026-10-01', kind: 'initial', qty: 7 }]);
  const c = await insertCustomer(db, ctx, { id: uid(tag), name: 'Tacos', nameKey: 'tacos', type: 'Restaurante', createdOn: '2026-10-01' });
  const o = await insertOrder(db, ctx, { id: uid(tag), number: await nextOrderNumber(db, ctx), customerId: c.id, status: 'accepted', channelId: w.channelId, createdOn: '2026-10-01', dueOn: '2026-10-10' });
  const s = await insertSale(db, ctx, { id: uid(tag), on: '2026-10-02', channelId: w.channelId, customerId: c.id, orderId: o.id });
  const [it] = await insertLineItems(db, ctx, [{ id: uid(tag), parentKind: 'order', parentId: o.id, kind: 'piece', productId: w.productId, name: 'Llavero', qty: 2, priceCents: 5000, listCents: 5000, costCents: 367.47, printerId: w.printerId }]);
  await insertLineItems(db, ctx, [{ id: uid(tag), parentKind: 'sale', parentId: s.id, kind: 'set', collectionId: w.collectionId, name: 'Set', qty: 1, priceCents: 9000, listCents: 9000, costCents: 800 }]);
  const [p] = await insertPayments(db, ctx, [{ id: uid(tag), parentKind: 'order', parentId: o.id, on: '2026-10-01', amountCents: 2000 }]);
  const r = await insertPrintRun(db, ctx, { id: uid(tag), on: '2026-10-03', productId: w.productId, qty: 1, printerId: w.printerId, result: 'ok', hours: 1, reason: 'stock' });
  await insertPrintRunFilaments(db, ctx, [{ id: uid(tag), printRunId: r.id, filamentId: w.filamentId, grams: 10 }]);
  const [q] = await insertQueueEntries(db, ctx, [{ id: uid(tag), printerId: w.printerId, orderId: o.id, text: '2 × Llavero', minutes: 60, position: 0 }]);
  return { customerId: c.id, orderId: o.id, saleId: s.id, itemId: it!.id, paymentId: p!.id, runId: r.id, queueId: q!.id };
}

let conn: Connection;
let A: WsData; let B: WsData; let a: SellData; let b: SellData;
beforeAll(async () => {
  conn = await openTestDb();
  ({ A, B } = await twoWorkspaces(conn.db));
  a = await sellData(conn, A, 0xa);
  b = await sellData(conn, B, 0xb);
});
afterAll(() => conn.close());

describe('sell and produce: reads with ctx A never return B', () => {
  it('stock ledger and levels', async () => {
    expect((await physicalStock(conn.db, A.ctx)).get(B.productId)).toBeUndefined();
    expect((await physicalStock(conn.db, A.ctx)).get(A.productId)).toBe(7);
    expect(await listStockMovements(conn.db, A.ctx, B.productId)).toEqual([]);
  });
  it('customers, orders, sales, items and payments', async () => {
    expect((await listCustomers(conn.db, A.ctx, { q: 'Tacos' })).map((c) => c.id)).toEqual([a.customerId]);
    expect(await getCustomer(conn.db, A.ctx, b.customerId)).toBeUndefined();
    expect((await findCustomerByKey(conn.db, A.ctx, 'tacos'))?.id).toBe(a.customerId);
    expect((await listOrders(conn.db, A.ctx)).map((o) => o.id)).toEqual([a.orderId]);
    expect(await getOrder(conn.db, A.ctx, b.orderId)).toBeUndefined();
    expect((await listSales(conn.db, A.ctx)).map((s) => s.id)).toEqual([a.saleId]);
    expect(await getSale(conn.db, A.ctx, b.saleId)).toBeUndefined();
    expect(await listLineItems(conn.db, A.ctx, 'order', [b.orderId])).toEqual([]);
    expect(await listPayments(conn.db, A.ctx, 'order', [b.orderId])).toEqual([]);
    expect(await usageOf(conn.db, A.ctx, { channelId: B.channelId })).toEqual({ sales: 0, orders: 0 });
    expect(await usageOf(conn.db, A.ctx, { customerId: a.customerId })).toEqual({ sales: 1, orders: 1 });
  });
  it('print runs, queues and expenses', async () => {
    expect((await listPrintRuns(conn.db, A.ctx)).map((r) => r.id)).toEqual([a.runId]);
    expect(await getPrintRun(conn.db, A.ctx, b.runId)).toBeUndefined();
    expect(await listPrintRunFilaments(conn.db, A.ctx, [b.runId])).toEqual([]);
    expect(await listQueue(conn.db, A.ctx, { printerIds: [B.printerId] })).toEqual([]);
    expect((await listQueue(conn.db, A.ctx)).map((q) => q.id)).toEqual([a.queueId]);
    expect((await listExpenses(conn.db, A.ctx)).every((e) => e.workspaceId === A.ctx.workspaceId)).toBe(true);
    const [eb] = await listExpenses(conn.db, B.ctx);
    expect(await getExpense(conn.db, A.ctx, eb!.id)).toBeUndefined();
  });
  it('folios are per workspace', async () => {
    expect(await nextOrderNumber(conn.db, A.ctx)).toBe(2);
    expect(await nextOrderNumber(conn.db, B.ctx)).toBe(2);
  });
});

describe('sell and produce: writes with ctx A never touch B', () => {
  it('updates and deletes with ids of B change nothing', async () => {
    const ctx: Ctx = A.ctx;
    expect(await updateCustomer(conn.db, ctx, b.customerId, { name: 'X' })).toBeUndefined();
    expect(await setCustomerDeleted(conn.db, ctx, b.customerId, new Date())).toBeUndefined();
    expect(await updateOrder(conn.db, ctx, b.orderId, { status: 'ready' })).toBeUndefined();
    expect(await setOrderDeleted(conn.db, ctx, b.orderId, new Date())).toBeUndefined();
    expect(await updateSale(conn.db, ctx, b.saleId, { note: 'x' })).toBeUndefined();
    expect(await setSaleDeleted(conn.db, ctx, b.saleId, new Date())).toBeUndefined();
    expect(await updateLineItem(conn.db, ctx, b.itemId, { printerId: null })).toBeUndefined();
    expect(await deletePayment(conn.db, ctx, 'order', b.orderId, b.paymentId)).toBeUndefined();
    expect(await deletePrintRun(conn.db, ctx, b.runId)).toBeUndefined();
    expect(await deleteLedgerRowsOfPrintRun(conn.db, ctx, b.runId)).toEqual([]);
    expect(await deleteQueueEntries(conn.db, ctx, { orderId: b.orderId })).toEqual([]);
    expect(await updateQueueEntry(conn.db, ctx, b.queueId, { position: 3 })).toBeUndefined();
    expect((await getOrder(conn.db, B.ctx, b.orderId))?.status).toBe('accepted');
    expect(await listPayments(conn.db, B.ctx, 'order', [b.orderId])).toHaveLength(1);
    expect(await listQueue(conn.db, B.ctx)).toHaveLength(1);
    expect(await getPrintRun(conn.db, B.ctx, b.runId)).toBeDefined();
  });
  it('composite keys reject children that point to B', async () => {
    const ctx = A.ctx;
    await expect(insertStockMovements(conn.db, ctx, [{ id: uid(0xa), productId: B.productId, on: '2026-10-01', kind: 'initial', qty: 1 }])).rejects.toThrow();
    await expect(insertOrder(conn.db, ctx, { id: uid(0xa), number: 99, customerId: b.customerId, status: 'quoted', channelId: A.channelId, createdOn: '2026-10-01', dueOn: '2026-10-01' })).rejects.toThrow();
    await expect(insertSale(conn.db, ctx, { id: uid(0xa), on: '2026-10-01', channelId: B.channelId })).rejects.toThrow();
    await expect(insertLineItems(conn.db, ctx, [{ id: uid(0xa), parentKind: 'sale', parentId: a.saleId, kind: 'piece', productId: B.productId, name: 'x', qty: 1, priceCents: 1, listCents: 1, costCents: 1 }])).rejects.toThrow();
    await expect(insertPrintRun(conn.db, ctx, { id: uid(0xa), on: '2026-10-01', productId: B.productId, qty: 1, result: 'ok', hours: 1, reason: 'stock' })).rejects.toThrow();
    await expect(insertQueueEntries(conn.db, ctx, [{ id: uid(0xa), printerId: B.printerId, orderId: a.orderId, text: 'x', minutes: 1, position: 0 }])).rejects.toThrow();
    await expect(insertPrintRunFilaments(conn.db, ctx, [{ id: uid(0xa), printRunId: a.runId, filamentId: B.filamentId, grams: 1 }])).rejects.toThrow();
  });
  it('a repository without ctx fails before SQL', async () => {
    await expect(listOrders(conn.db, undefined as unknown as Ctx)).rejects.toThrow();
    await expect(insertCustomer(conn.db, {} as Ctx, { id: uid(1), name: 'x', nameKey: 'x', type: 'Otro', createdOn: '2026-10-01' })).rejects.toThrow();
  });
});
