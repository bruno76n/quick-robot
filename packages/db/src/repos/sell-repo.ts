// Stock, customers, orders, sales, line items, payments, print runs, queues and expenses. Every function takes ctx.
import { and, asc, count, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, ne, or, sql, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { Ctx } from '../ctx';
import type { Executor } from '../db';
import { customer, expense, lineItem, order, payment, printQueueEntry, printRun, printRunFilament, sale, salesChannel, spool, spoolMovement, stockLevels, stockMovement, supplyMovement, workspace } from '../schema';
import { inWorkspace, likePattern } from './scope';

type NewRow<T extends { $inferInsert: object }> = Omit<T['$inferInsert'], 'workspaceId' | 'createdAt' | 'updatedAt' | 'deletedAt'>;
export type StockMovementRow = typeof stockMovement.$inferSelect;
export type CustomerRow = typeof customer.$inferSelect;
export type OrderRow = typeof order.$inferSelect;
export type SaleRow = typeof sale.$inferSelect;
export type LineItemRow = typeof lineItem.$inferSelect;
export type PaymentRow = typeof payment.$inferSelect;
export type PrintRunRow = typeof printRun.$inferSelect;
export type PrintRunFilamentRow = typeof printRunFilament.$inferSelect;
export type QueueEntryRow = typeof printQueueEntry.$inferSelect;
export type ExpenseListRow = typeof expense.$inferSelect;
export type ParentKind = 'order' | 'sale';

const live = (deletedAt: PgColumn, deleted?: boolean) => (deleted ? isNotNull(deletedAt) : isNull(deletedAt));

async function insertMany<T extends PgTable & { workspaceId: PgColumn }>(ex: Executor, ctx: Ctx, table: T, rows: readonly object[]) {
  inWorkspace(table.workspaceId, ctx);
  if (!rows.length) return [];
  return ex.insert(table).values(rows.map((r) => ({ ...r, workspaceId: ctx.workspaceId })) as never).returning() as Promise<T['$inferSelect'][]>;
}

// ---------- Stock ----------
export const insertStockMovements = (ex: Executor, ctx: Ctx, rows: readonly Omit<typeof stockMovement.$inferInsert, 'workspaceId' | 'createdAt'>[]) => insertMany(ex, ctx, stockMovement, rows);

export async function listStockMovements(ex: Executor, ctx: Ctx, productId: string, limit = 200): Promise<StockMovementRow[]> {
  return ex.select().from(stockMovement).where(and(inWorkspace(stockMovement.workspaceId, ctx), eq(stockMovement.productId, productId)))
    .orderBy(desc(stockMovement.on), desc(stockMovement.createdAt), desc(stockMovement.id)).limit(limit);
}

/** Physical pieces per live product (stock_levels view). */
export async function physicalStock(ex: Executor, ctx: Ctx, productIds?: readonly string[]): Promise<Map<string, number>> {
  if (productIds && !productIds.length) return new Map();
  const rows = await ex.select().from(stockLevels).where(and(inWorkspace(stockLevels.workspaceId, ctx), productIds ? inArray(stockLevels.productId, [...productIds]) : undefined));
  return new Map(rows.map((r) => [r.productId, Number(r.physical)]));
}

export async function stockMovementsByRef(ex: Executor, ctx: Ctx, refId: string) {
  return ex.select().from(stockMovement).where(and(inWorkspace(stockMovement.workspaceId, ctx), eq(stockMovement.refId, refId)));
}

/** Only used when undoing a print run, which removes its own ledger rows in the same transaction (docs/05). */
export async function deleteLedgerRowsOfPrintRun(ex: Executor, ctx: Ctx, runId: string) {
  await ex.delete(stockMovement).where(and(inWorkspace(stockMovement.workspaceId, ctx), eq(stockMovement.refId, runId), eq(stockMovement.kind, 'print')));
  await ex.delete(supplyMovement).where(and(inWorkspace(supplyMovement.workspaceId, ctx), eq(supplyMovement.refId, runId)));
  return ex.delete(spoolMovement).where(and(inWorkspace(spoolMovement.workspaceId, ctx), eq(spoolMovement.refId, runId))).returning();
}

// ---------- Customers ----------
export async function listCustomers(ex: Executor, ctx: Ctx, opts: { q?: string | undefined; withDeleted?: boolean } = {}): Promise<CustomerRow[]> {
  return ex.select().from(customer).where(and(
    inWorkspace(customer.workspaceId, ctx), opts.withDeleted ? undefined : isNull(customer.deletedAt),
    opts.q ? or(ilike(customer.name, likePattern(opts.q)), ilike(customer.phone, likePattern(opts.q)), ilike(customer.note, likePattern(opts.q))) : undefined,
  )).orderBy(asc(customer.createdAt), asc(customer.id));
}

export async function getCustomer(ex: Executor, ctx: Ctx, id: string, opts: { deleted?: boolean } = {}) {
  const [r] = await ex.select().from(customer).where(and(inWorkspace(customer.workspaceId, ctx), eq(customer.id, id), live(customer.deletedAt, opts.deleted)));
  return r;
}

export async function findCustomerByKey(ex: Executor, ctx: Ctx, nameKey: string, exceptId?: string) {
  const [r] = await ex.select().from(customer).where(and(inWorkspace(customer.workspaceId, ctx), eq(customer.nameKey, nameKey), isNull(customer.deletedAt), exceptId ? ne(customer.id, exceptId) : undefined));
  return r;
}

export async function insertCustomer(ex: Executor, ctx: Ctx, row: NewRow<typeof customer>) {
  return (await insertMany(ex, ctx, customer, [row]))[0]!;
}

export async function updateCustomer(ex: Executor, ctx: Ctx, id: string, patch: Partial<NewRow<typeof customer>>) {
  const [r] = await ex.update(customer).set({ ...patch, updatedAt: new Date() }).where(and(inWorkspace(customer.workspaceId, ctx), eq(customer.id, id), isNull(customer.deletedAt))).returning();
  return r;
}

export async function setCustomerDeleted(ex: Executor, ctx: Ctx, id: string, deletedAt: Date | null) {
  const [r] = await ex.update(customer).set({ deletedAt, updatedAt: new Date() }).where(and(inWorkspace(customer.workspaceId, ctx), eq(customer.id, id), live(customer.deletedAt, !deletedAt))).returning();
  return r;
}

// ---------- Orders ----------
export interface OrderFilter { statuses?: readonly string[] | undefined; customerId?: string | undefined; ids?: readonly string[] | undefined; dueFrom?: string | undefined; dueTo?: string | undefined }
export async function listOrders(ex: Executor, ctx: Ctx, f: OrderFilter & { limit?: number; offset?: number; newestFirst?: boolean } = {}): Promise<OrderRow[]> {
  if (f.ids && !f.ids.length) return [];
  let q = ex.select().from(order).where(and(
    inWorkspace(order.workspaceId, ctx), isNull(order.deletedAt),
    f.statuses ? inArray(order.status, [...f.statuses]) : undefined, f.customerId ? eq(order.customerId, f.customerId) : undefined,
    f.ids ? inArray(order.id, [...f.ids]) : undefined, f.dueFrom ? gte(order.dueOn, f.dueFrom) : undefined, f.dueTo ? lte(order.dueOn, f.dueTo) : undefined,
  )).orderBy(f.newestFirst ? desc(order.number) : asc(order.number)).$dynamic();
  if (f.limit !== undefined) q = q.limit(f.limit).offset(f.offset ?? 0);
  return q;
}

export async function countOrders(ex: Executor, ctx: Ctx, f: OrderFilter = {}) {
  const [r] = await ex.select({ n: count() }).from(order).where(and(inWorkspace(order.workspaceId, ctx), isNull(order.deletedAt), f.statuses ? inArray(order.status, [...f.statuses]) : undefined, f.customerId ? eq(order.customerId, f.customerId) : undefined));
  return r?.n ?? 0;
}

export async function getOrder(ex: Executor, ctx: Ctx, id: string, opts: { deleted?: boolean; forUpdate?: boolean } = {}) {
  const q = ex.select().from(order).where(and(inWorkspace(order.workspaceId, ctx), eq(order.id, id), live(order.deletedAt, opts.deleted)));
  const [r] = opts.forUpdate ? await q.for('update') : await q;
  return r;
}

/** Next folio for the workspace; the workspace row is locked so two creations never share a number. */
export async function nextOrderNumber(ex: Executor, ctx: Ctx): Promise<number> {
  await ex.select({ id: workspace.id }).from(workspace).where(eq(workspace.id, ctx.workspaceId)).for('update');
  const [r] = await ex.select({ n: sql<number>`coalesce(max(${order.number}), 0)` }).from(order).where(inWorkspace(order.workspaceId, ctx));
  return Number(r?.n ?? 0) + 1;
}

export async function insertOrder(ex: Executor, ctx: Ctx, row: NewRow<typeof order>) {
  return (await insertMany(ex, ctx, order, [row]))[0]!;
}

export async function updateOrder(ex: Executor, ctx: Ctx, id: string, patch: Partial<NewRow<typeof order>>) {
  const [r] = await ex.update(order).set({ ...patch, updatedAt: new Date() }).where(and(inWorkspace(order.workspaceId, ctx), eq(order.id, id), isNull(order.deletedAt))).returning();
  return r;
}

export async function setOrderDeleted(ex: Executor, ctx: Ctx, id: string, deletedAt: Date | null) {
  const [r] = await ex.update(order).set({ deletedAt, updatedAt: new Date() }).where(and(inWorkspace(order.workspaceId, ctx), eq(order.id, id), live(order.deletedAt, !deletedAt))).returning();
  return r;
}

// ---------- Sales ----------
export interface SaleFilter { from?: string | undefined; to?: string | undefined; channelId?: string | undefined; customerId?: string | undefined; orderId?: string | undefined; ids?: readonly string[] | undefined; owedOnly?: boolean | undefined; notReturned?: boolean | undefined }
const saleWhere = (ctx: Ctx, f: SaleFilter): SQL | undefined => and(
  inWorkspace(sale.workspaceId, ctx), isNull(sale.deletedAt),
  f.from ? gte(sale.on, f.from) : undefined, f.to ? lte(sale.on, f.to) : undefined, f.channelId ? eq(sale.channelId, f.channelId) : undefined,
  f.customerId ? eq(sale.customerId, f.customerId) : undefined, f.orderId ? eq(sale.orderId, f.orderId) : undefined, f.ids ? inArray(sale.id, [...f.ids]) : undefined,
  f.owedOnly ? and(eq(sale.tracksPayments, true), isNull(sale.return)) : undefined, f.notReturned ? isNull(sale.return) : undefined,
);
export async function listSales(ex: Executor, ctx: Ctx, f: SaleFilter = {}): Promise<SaleRow[]> {
  if (f.ids && !f.ids.length) return [];
  return ex.select().from(sale).where(saleWhere(ctx, f)).orderBy(desc(sale.on), desc(sale.createdAt), desc(sale.id));
}
export async function countSales(ex: Executor, ctx: Ctx, f: SaleFilter = {}) {
  const [r] = await ex.select({ n: count() }).from(sale).where(saleWhere(ctx, f));
  return r?.n ?? 0;
}

export async function getSale(ex: Executor, ctx: Ctx, id: string, opts: { deleted?: boolean; forUpdate?: boolean } = {}) {
  const q = ex.select().from(sale).where(and(inWorkspace(sale.workspaceId, ctx), eq(sale.id, id), live(sale.deletedAt, opts.deleted)));
  const [r] = opts.forUpdate ? await q.for('update') : await q;
  return r;
}

export async function insertSale(ex: Executor, ctx: Ctx, row: NewRow<typeof sale>) {
  return (await insertMany(ex, ctx, sale, [row]))[0]!;
}

export async function updateSale(ex: Executor, ctx: Ctx, id: string, patch: Partial<NewRow<typeof sale>>) {
  const [r] = await ex.update(sale).set({ ...patch, updatedAt: new Date() }).where(and(inWorkspace(sale.workspaceId, ctx), eq(sale.id, id), isNull(sale.deletedAt))).returning();
  return r;
}

export async function setSaleDeleted(ex: Executor, ctx: Ctx, id: string, deletedAt: Date | null) {
  const [r] = await ex.update(sale).set({ deletedAt, updatedAt: new Date() }).where(and(inWorkspace(sale.workspaceId, ctx), eq(sale.id, id), live(sale.deletedAt, !deletedAt))).returning();
  return r;
}

/** Live sales and orders that point to a channel or a customer (CHANNEL_IN_USE, CUSTOMER_HAS_HISTORY). */
export async function usageOf(ex: Executor, ctx: Ctx, by: { channelId?: string; customerId?: string }) {
  const s = by.channelId ? eq(sale.channelId, by.channelId) : eq(sale.customerId, by.customerId!);
  const o = by.channelId ? eq(order.channelId, by.channelId) : eq(order.customerId, by.customerId!);
  const [a] = await ex.select({ n: count() }).from(sale).where(and(inWorkspace(sale.workspaceId, ctx), isNull(sale.deletedAt), s));
  const [b] = await ex.select({ n: count() }).from(order).where(and(inWorkspace(order.workspaceId, ctx), isNull(order.deletedAt), o));
  return { sales: a?.n ?? 0, orders: b?.n ?? 0 };
}

// ---------- Line items and payments ----------
export const insertLineItems = (ex: Executor, ctx: Ctx, rows: readonly NewRow<typeof lineItem>[]) => insertMany(ex, ctx, lineItem, rows);

export async function listLineItems(ex: Executor, ctx: Ctx, parentKind: ParentKind, parentIds: readonly string[]): Promise<LineItemRow[]> {
  if (!parentIds.length) return [];
  return ex.select().from(lineItem).where(and(inWorkspace(lineItem.workspaceId, ctx), eq(lineItem.parentKind, parentKind), inArray(lineItem.parentId, [...parentIds])))
    .orderBy(asc(lineItem.parentId), asc(lineItem.position));
}

/** Replacing the items of an order that is still active (updateOrder). */
export async function deleteLineItems(ex: Executor, ctx: Ctx, parentKind: ParentKind, parentId: string) {
  return ex.delete(lineItem).where(and(inWorkspace(lineItem.workspaceId, ctx), eq(lineItem.parentKind, parentKind), eq(lineItem.parentId, parentId)));
}

export async function updateLineItem(ex: Executor, ctx: Ctx, id: string, patch: Partial<Pick<LineItemRow, 'printerId' | 'fromStock'>>) {
  const [r] = await ex.update(lineItem).set({ ...patch, updatedAt: new Date() }).where(and(inWorkspace(lineItem.workspaceId, ctx), eq(lineItem.id, id))).returning();
  return r;
}

export const insertPayments = (ex: Executor, ctx: Ctx, rows: readonly NewRow<typeof payment>[]) => insertMany(ex, ctx, payment, rows);

export async function listPayments(ex: Executor, ctx: Ctx, parentKind: ParentKind, parentIds: readonly string[]): Promise<PaymentRow[]> {
  if (!parentIds.length) return [];
  return ex.select().from(payment).where(and(inWorkspace(payment.workspaceId, ctx), eq(payment.parentKind, parentKind), inArray(payment.parentId, [...parentIds])))
    .orderBy(asc(payment.on), asc(payment.createdAt), asc(payment.id));
}

export async function deletePayment(ex: Executor, ctx: Ctx, parentKind: ParentKind, parentId: string, id: string) {
  const [r] = await ex.delete(payment).where(and(inWorkspace(payment.workspaceId, ctx), eq(payment.parentKind, parentKind), eq(payment.parentId, parentId), eq(payment.id, id))).returning();
  return r;
}

// ---------- Print runs ----------
export const insertPrintRun = async (ex: Executor, ctx: Ctx, row: NewRow<typeof printRun>) => (await insertMany(ex, ctx, printRun, [row]))[0]!;
export const insertPrintRunFilaments = (ex: Executor, ctx: Ctx, rows: readonly Omit<typeof printRunFilament.$inferInsert, 'workspaceId'>[]) => insertMany(ex, ctx, printRunFilament, rows);

export interface PrintRunFilter { reason?: string | undefined; productId?: string | undefined; orderId?: string | undefined; ids?: readonly string[] | undefined; from?: string | undefined; to?: string | undefined }
const runWhere = (ctx: Ctx, f: PrintRunFilter) => and(
  inWorkspace(printRun.workspaceId, ctx), f.reason ? eq(printRun.reason, f.reason) : undefined,
  f.productId ? eq(printRun.productId, f.productId) : undefined, f.orderId ? eq(printRun.orderId, f.orderId) : undefined,
  f.ids ? inArray(printRun.id, [...f.ids]) : undefined, f.from ? gte(printRun.on, f.from) : undefined, f.to ? lte(printRun.on, f.to) : undefined,
);
export async function listPrintRuns(ex: Executor, ctx: Ctx, f: PrintRunFilter & { limit?: number; offset?: number } = {}): Promise<PrintRunRow[]> {
  if (f.ids && !f.ids.length) return [];
  let q = ex.select().from(printRun).where(runWhere(ctx, f)).orderBy(desc(printRun.on), desc(printRun.createdAt), desc(printRun.id)).$dynamic();
  if (f.limit !== undefined) q = q.limit(f.limit).offset(f.offset ?? 0);
  return q;
}

/** Count, good pieces, hours, failures and grams of the filtered runs, in SQL. */
export async function printRunTotals(ex: Executor, ctx: Ctx, f: PrintRunFilter = {}) {
  const [r] = await ex.select({
    n: count(), pieces: sql<string>`coalesce(sum(case when ${printRun.result} = 'ok' then ${printRun.qty} else 0 end), 0)`,
    hours: sql<string>`coalesce(sum(${printRun.hours}), 0)`, failed: sql<string>`count(*) filter (where ${printRun.result} = 'fail')`,
    grams: sql<string>`coalesce((select sum(f.grams) from ${printRunFilament} f where f.workspace_id = ${ctx.workspaceId} and f.print_run_id in (select id from ${printRun} where ${runWhere(ctx, f)})), 0)`,
  }).from(printRun).where(runWhere(ctx, f));
  return { count: r?.n ?? 0, pieces: Number(r?.pieces ?? 0), hours: Number(r?.hours ?? 0), failed: Number(r?.failed ?? 0), grams: Number(r?.grams ?? 0) };
}

export async function getPrintRun(ex: Executor, ctx: Ctx, id: string, opts: { forUpdate?: boolean } = {}) {
  const q = ex.select().from(printRun).where(and(inWorkspace(printRun.workspaceId, ctx), eq(printRun.id, id)));
  const [r] = opts.forUpdate ? await q.for('update') : await q;
  return r;
}

export async function listPrintRunFilaments(ex: Executor, ctx: Ctx, runIds: readonly string[]): Promise<PrintRunFilamentRow[]> {
  if (!runIds.length) return [];
  return ex.select().from(printRunFilament).where(and(inWorkspace(printRunFilament.workspaceId, ctx), inArray(printRunFilament.printRunId, [...runIds])));
}

export async function deletePrintRun(ex: Executor, ctx: Ctx, id: string) {
  await ex.delete(printRunFilament).where(and(inWorkspace(printRunFilament.workspaceId, ctx), eq(printRunFilament.printRunId, id)));
  const [r] = await ex.delete(printRun).where(and(inWorkspace(printRun.workspaceId, ctx), eq(printRun.id, id))).returning();
  return r;
}

// ---------- Queues ----------
export async function listQueue(ex: Executor, ctx: Ctx, f: { printerIds?: readonly string[]; orderId?: string; forUpdate?: boolean } = {}): Promise<QueueEntryRow[]> {
  if (f.printerIds && !f.printerIds.length) return [];
  const q = ex.select().from(printQueueEntry).where(and(
    inWorkspace(printQueueEntry.workspaceId, ctx), f.printerIds ? inArray(printQueueEntry.printerId, [...f.printerIds]) : undefined, f.orderId ? eq(printQueueEntry.orderId, f.orderId) : undefined,
  )).orderBy(asc(printQueueEntry.printerId), asc(printQueueEntry.position), asc(printQueueEntry.id));
  return f.forUpdate ? q.for('update') : q;
}
export const insertQueueEntries = (ex: Executor, ctx: Ctx, rows: readonly NewRow<typeof printQueueEntry>[]) => insertMany(ex, ctx, printQueueEntry, rows);
export async function deleteQueueEntries(ex: Executor, ctx: Ctx, f: { orderId?: string; id?: string }) {
  return ex.delete(printQueueEntry).where(and(inWorkspace(printQueueEntry.workspaceId, ctx), f.orderId ? eq(printQueueEntry.orderId, f.orderId) : undefined, f.id ? eq(printQueueEntry.id, f.id) : undefined)).returning();
}
export async function updateQueueEntry(ex: Executor, ctx: Ctx, id: string, patch: Partial<Pick<QueueEntryRow, 'startedAt' | 'position'>>) {
  const [r] = await ex.update(printQueueEntry).set({ ...patch, updatedAt: new Date() }).where(and(inWorkspace(printQueueEntry.workspaceId, ctx), eq(printQueueEntry.id, id))).returning();
  return r;
}

// ---------- Expenses ----------
export async function listExpenses(ex: Executor, ctx: Ctx, f: { category?: string | undefined } = {}): Promise<ExpenseListRow[]> {
  return ex.select().from(expense).where(and(inWorkspace(expense.workspaceId, ctx), isNull(expense.deletedAt), f.category ? eq(expense.category, f.category) : undefined))
    .orderBy(desc(expense.on), desc(expense.createdAt), desc(expense.id));
}
export async function getExpense(ex: Executor, ctx: Ctx, id: string, opts: { deleted?: boolean } = {}) {
  const [r] = await ex.select().from(expense).where(and(inWorkspace(expense.workspaceId, ctx), eq(expense.id, id), live(expense.deletedAt, opts.deleted)));
  return r;
}
export async function updateExpense(ex: Executor, ctx: Ctx, id: string, patch: Partial<NewRow<typeof expense>>) {
  const [r] = await ex.update(expense).set({ ...patch, updatedAt: new Date() }).where(and(inWorkspace(expense.workspaceId, ctx), eq(expense.id, id), isNull(expense.deletedAt))).returning();
  return r;
}
export async function setExpenseDeleted(ex: Executor, ctx: Ctx, id: string, deletedAt: Date | null) {
  const [r] = await ex.update(expense).set({ deletedAt, updatedAt: new Date() }).where(and(inWorkspace(expense.workspaceId, ctx), eq(expense.id, id), live(expense.deletedAt, !deletedAt))).returning();
  return r;
}

// ---------- Aggregates for lists, reports and home (docs/15 §3: the database sums, the app does not walk rows) ----------
export interface SaleFact {
  id: string; on: string; channelId: string; customerId: string | null; orderId: string | null; note: string; tracksPayments: boolean; return: SaleRow['return'];
  grossCents: number; costCents: number; listCents: number; pieces: number; paidCents: number; itemsText: string;
}
/** Sums of the items and payments of some sales (by id), or of all live sales. */
async function saleSums(ex: Executor, ctx: Ctx, ids?: readonly string[]) {
  if (ids && !ids.length) return new Map<string, { gross: number; cost: number; list: number; pieces: number; text: string; paid: number }>();
  const byIds = (col: PgColumn) => (ids ? inArray(col, [...ids]) : undefined);
  const items = await ex.select({
    parentId: lineItem.parentId,
    gross: sql<string>`sum(${lineItem.qty} * ${lineItem.priceCents})`, cost: sql<string>`sum(${lineItem.qty} * ${lineItem.costCents})`,
    list: sql<string>`sum(${lineItem.qty} * ${lineItem.listCents})`,
    pieces: sql<string>`sum(case when ${lineItem.kind} = 'set' then ${lineItem.qty} * coalesce((select sum((p->>'qty')::int) from jsonb_array_elements(${lineItem.parts}) p), 0) else ${lineItem.qty} end)`,
    text: sql<string>`string_agg(${lineItem.qty} || ' × ' || ${lineItem.name}, ', ' order by ${lineItem.position})`,
  }).from(lineItem).where(and(inWorkspace(lineItem.workspaceId, ctx), eq(lineItem.parentKind, 'sale'), byIds(lineItem.parentId))).groupBy(lineItem.parentId);
  const pays = await ex.select({ parentId: payment.parentId, paid: sql<string>`sum(${payment.amountCents})` })
    .from(payment).where(and(inWorkspace(payment.workspaceId, ctx), eq(payment.parentKind, 'sale'), byIds(payment.parentId))).groupBy(payment.parentId);
  const paid = new Map(pays.map((p) => [p.parentId, Number(p.paid)]));
  return new Map(items.map((r) => [r.parentId, { gross: Number(r.gross), cost: Number(r.cost), list: Number(r.list), pieces: Number(r.pieces), text: r.text ?? '', paid: paid.get(r.parentId) ?? 0 }]));
}

/** Free text over the note, the customer name and the item names, in SQL (the list never loads every row). */
const saleText = (ctx: Ctx, q?: string) => (q ? or(
  ilike(sale.note, likePattern(q)),
  sql`exists (select 1 from ${customer} c where c.workspace_id = ${ctx.workspaceId} and c.id = ${sale.customerId} and c.name ilike ${likePattern(q)})`,
  sql`exists (select 1 from ${lineItem} li where li.workspace_id = ${ctx.workspaceId} and li.parent_kind = 'sale' and li.parent_id = ${sale.id} and li.name ilike ${likePattern(q)})`,
) : undefined);

/** One row per live sale with its sums; with limit, only that page is summed (index on sale (workspace_id, on)). */
export async function saleFacts(ex: Executor, ctx: Ctx, f: SaleFilter & { q?: string | undefined; limit?: number; offset?: number } = {}): Promise<SaleFact[]> {
  if (f.ids && !f.ids.length) return [];
  let q = ex.select().from(sale).where(and(saleWhere(ctx, f), saleText(ctx, f.q)))
    .orderBy(desc(sale.on), desc(sale.createdAt), desc(sale.id)).$dynamic();
  if (f.limit !== undefined) q = q.limit(f.limit).offset(f.offset ?? 0);
  const rows = await q;
  const sums = await saleSums(ex, ctx, f.limit !== undefined || f.ids || f.owedOnly || f.from || f.customerId || f.orderId ? rows.map((r) => r.id) : undefined);
  return rows.map((s) => {
    const x = sums.get(s.id) ?? { gross: 0, cost: 0, list: 0, pieces: 0, text: '', paid: 0 };
    return { id: s.id, on: s.on, channelId: s.channelId, customerId: s.customerId, orderId: s.orderId, note: s.note, tracksPayments: s.tracksPayments, return: s.return, grossCents: x.gross, costCents: x.cost, listCents: x.list, pieces: x.pieces, paidCents: x.paid, itemsText: x.text };
  });
}

export interface SaleTotalsRow { key: string | null; lastOn: string | null; discountCents: number; keptCostCents: number; keptCount: number; count: number; grossCents: number; incomeCents: number; commissionCents: number; costCents: number; owedCents: number; pieces: number; listCents: number }
/** Totals of the filtered sales in one SQL query (docs/04 §6 rules), optionally per customer or channel. */
export async function saleTotals(ex: Executor, ctx: Ctx, f: SaleFilter & { q?: string | undefined } = {}, by?: 'customer' | 'channel' | 'day' | 'all'): Promise<SaleTotalsRow[]> {
  // The sums only read the items and payments of the sales in the filter (index line_item (workspace_id, parent_kind, parent_id)).
  const scope = () => ex.select({ id: sale.id }).from(sale).where(and(saleWhere(ctx, f), saleText(ctx, f.q)));
  const it = ex.select({
    parentId: lineItem.parentId, gross: sql<string>`sum(${lineItem.qty} * ${lineItem.priceCents})`.as('gross'), cost: sql<string>`sum(${lineItem.qty} * ${lineItem.costCents})`.as('cost'),
    list: sql<string>`sum(${lineItem.qty} * ${lineItem.listCents})`.as('list'),
    discount: sql<string>`sum(greatest(0, ${lineItem.qty} * ${lineItem.listCents} - ${lineItem.qty} * ${lineItem.priceCents}))`.as('discount'),
    pieces: sql<string>`sum(case when ${lineItem.kind} = 'set' then ${lineItem.qty} * coalesce((select sum((p->>'qty')::int) from jsonb_array_elements(${lineItem.parts}) p), 0) else ${lineItem.qty} end)`.as('pieces'),
  }).from(lineItem).where(and(eq(lineItem.workspaceId, ctx.workspaceId), eq(lineItem.parentKind, 'sale'), inArray(lineItem.parentId, scope()))).groupBy(lineItem.parentId).as('it');
  const pa = ex.select({ parentId: payment.parentId, paid: sql<string>`sum(${payment.amountCents})`.as('paid') }).from(payment)
    .where(and(eq(payment.workspaceId, ctx.workspaceId), eq(payment.parentKind, 'sale'), inArray(payment.parentId, scope()))).groupBy(payment.parentId).as('pa');
  const gross = sql`coalesce(${it.gross}, 0)`;
  const income = sql`case when ${sale.return} is null then ${gross} else 0 end`;
  const key = by === 'customer' ? sale.customerId : by === 'channel' ? sale.channelId : by === 'day' ? sql<string>`${sale.on}::text`
    // 'all': one pass with grouping sets; the key says which group the row belongs to (total, c:…, h:…, d:…).
    : by === 'all' ? sql<string>`case when grouping(${sale.customerId}) = 0 then 'c:' || coalesce(${sale.customerId}::text, '') when grouping(${sale.channelId}) = 0 then 'h:' || ${sale.channelId}::text when grouping(${sale.on}) = 0 then 'd:' || ${sale.on}::text else 'total' end`
    : sql<string>`null`;
  const base = ex.select({
    key: by ? sql<string | null>`${key}` : sql<string | null>`min(null::text)`, lastOn: sql<string | null>`max(${sale.on})`, count: sql<string>`count(*)`, gross: sql<string>`sum(${gross})`, income: sql<string>`sum(${income})`,
    commission: sql<string>`sum(${income} * ${salesChannel.commissionPct} / 100)`,
    cost: sql<string>`sum(case when (${sale.return}->>'restock')::boolean then 0 else coalesce(${it.cost}, 0) end)`,
    owed: sql<string>`sum(case when ${sale.tracksPayments} and ${sale.return} is null then greatest(0, ${gross} - coalesce(${pa.paid}, 0)) else 0 end)`,
    pieces: sql<string>`sum(case when ${sale.return} is null then coalesce(${it.pieces}, 0) else 0 end)`,
    list: sql<string>`sum(case when ${sale.return} is null then coalesce(${it.list}, 0) else 0 end)`,
    discount: sql<string>`sum(case when ${sale.return} is null then coalesce(${it.discount}, 0) else 0 end)`,
    keptCost: sql<string>`sum(case when ${sale.return} is null then coalesce(${it.cost}, 0) else 0 end)`, keptCount: sql<string>`count(*) filter (where ${sale.return} is null)`,
  }).from(sale)
    .leftJoin(it, eq(it.parentId, sale.id)).leftJoin(pa, eq(pa.parentId, sale.id))
    .leftJoin(salesChannel, and(eq(salesChannel.workspaceId, sale.workspaceId), eq(salesChannel.id, sale.channelId)))
    .where(and(saleWhere(ctx, f), saleText(ctx, f.q))).$dynamic();
  const rows = by === 'all' ? await base.groupBy(sql`grouping sets ((${sale.customerId}), (${sale.channelId}), (${sale.on}), ())`) : by ? await base.groupBy(sql`${key}`) : await base;
  return rows.map((r) => ({ key: r.key, lastOn: r.lastOn, discountCents: Number(r.discount ?? 0), keptCostCents: Number(r.keptCost ?? 0), keptCount: Number(r.keptCount ?? 0), count: Number(r.count), grossCents: Number(r.gross ?? 0), incomeCents: Number(r.income ?? 0), commissionCents: Number(r.commission ?? 0), costCents: Number(r.cost ?? 0), owedCents: Number(r.owed ?? 0), pieces: Number(r.pieces ?? 0), listCents: Number(r.list ?? 0) }));
}

export interface OrderFact { id: string; number: number; customerId: string; status: string; channelId: string; createdOn: string; dueOn: string; deliveredOn: string | null; filamentDeducted: boolean; grossCents: number; costCents: number; paidCents: number }
/** One row per live order with its sums. */
export async function orderFacts(ex: Executor, ctx: Ctx, f: OrderFilter = {}): Promise<OrderFact[]> {
  inWorkspace(order.workspaceId, ctx);
  const items = ex.select({ parentId: lineItem.parentId, gross: sql<string>`sum(${lineItem.qty} * ${lineItem.priceCents})`.as('gross'), cost: sql<string>`sum(${lineItem.qty} * ${lineItem.costCents})`.as('cost') })
    .from(lineItem).where(and(eq(lineItem.workspaceId, ctx.workspaceId), eq(lineItem.parentKind, 'order'))).groupBy(lineItem.parentId).as('it');
  const pays = ex.select({ parentId: payment.parentId, paid: sql<string>`sum(${payment.amountCents})`.as('paid') })
    .from(payment).where(and(eq(payment.workspaceId, ctx.workspaceId), eq(payment.parentKind, 'order'))).groupBy(payment.parentId).as('pa');
  const rows = await ex.select({ o: order, gross: items.gross, cost: items.cost, paid: pays.paid }).from(order)
    .leftJoin(items, eq(items.parentId, order.id)).leftJoin(pays, eq(pays.parentId, order.id))
    .where(and(inWorkspace(order.workspaceId, ctx), isNull(order.deletedAt), f.statuses ? inArray(order.status, [...f.statuses]) : undefined, f.customerId ? eq(order.customerId, f.customerId) : undefined))
    .orderBy(asc(order.number));
  return rows.map((r) => ({ id: r.o.id, number: r.o.number, customerId: r.o.customerId, status: r.o.status, channelId: r.o.channelId, createdOn: r.o.createdOn, dueOn: r.o.dueOn, deliveredOn: r.o.deliveredOn, filamentDeducted: r.o.filamentDeducted, grossCents: Number(r.gross ?? 0), costCents: Number(r.cost ?? 0), paidCents: Number(r.paid ?? 0) }));
}

/** Pieces sold per product (sets opened into their parts) and sets per collection, without returned sales. */
export async function soldTotals(ex: Executor, ctx: Ctx) {
  inWorkspace(sale.workspaceId, ctx);
  const live = and(eq(sale.workspaceId, ctx.workspaceId), isNull(sale.deletedAt), isNull(sale.return));
  const pieces = await ex.select({ productId: lineItem.productId, n: sql<string>`sum(${lineItem.qty})` }).from(lineItem)
    .innerJoin(sale, and(eq(sale.workspaceId, lineItem.workspaceId), eq(sale.id, lineItem.parentId)))
    .where(and(live, eq(lineItem.parentKind, 'sale'), eq(lineItem.kind, 'piece'))).groupBy(lineItem.productId);
  const parts = await ex.select({ productId: sql<string>`p->>'productId'`, n: sql<string>`sum(${lineItem.qty} * (p->>'qty')::int)` })
    .from(sql`${lineItem} cross join lateral jsonb_array_elements(${lineItem.parts}) p`)
    .innerJoin(sale, and(eq(sale.workspaceId, lineItem.workspaceId), eq(sale.id, lineItem.parentId)))
    .where(and(live, eq(lineItem.parentKind, 'sale'), eq(lineItem.kind, 'set'))).groupBy(sql`p->>'productId'`);
  const sets = await ex.select({ collectionId: lineItem.collectionId, n: sql<string>`sum(${lineItem.qty})` }).from(lineItem)
    .innerJoin(sale, and(eq(sale.workspaceId, lineItem.workspaceId), eq(sale.id, lineItem.parentId)))
    .where(and(live, eq(lineItem.parentKind, 'sale'), eq(lineItem.kind, 'set'))).groupBy(lineItem.collectionId);
  const products = new Map<string, number>();
  for (const r of [...pieces, ...parts]) if (r.productId) products.set(r.productId, (products.get(r.productId) ?? 0) + Number(r.n));
  return { products, collections: new Map(sets.filter((r) => r.collectionId).map((r) => [r.collectionId!, Number(r.n)])) };
}

/** Date of the oldest live, not returned sale ("Todo" in Reportes starts there). */
export async function firstSaleOn(ex: Executor, ctx: Ctx): Promise<string | null> {
  const [r] = await ex.select({ on: sql<string | null>`min(${sale.on})` }).from(sale).where(and(inWorkspace(sale.workspaceId, ctx), isNull(sale.deletedAt), isNull(sale.return)));
  return r?.on ?? null;
}

/** Grams spent per filament and kind in a date range (consumption, failure, waste), summed in SQL. */
export async function spoolUseByFilament(ex: Executor, ctx: Ctx, from: string, to: string) {
  const rows = await ex.select({ filamentId: spool.filamentId, kind: spoolMovement.kind, grams: sql<string>`sum(-${spoolMovement.grams})` })
    .from(spoolMovement).innerJoin(spool, and(eq(spool.workspaceId, spoolMovement.workspaceId), eq(spool.id, spoolMovement.spoolId)))
    .where(and(inWorkspace(spoolMovement.workspaceId, ctx), gte(spoolMovement.on, from), lte(spoolMovement.on, to), inArray(spoolMovement.kind, ['consumption', 'failure', 'waste'])))
    .groupBy(spool.filamentId, spoolMovement.kind);
  return rows.map((r) => ({ filamentId: r.filamentId, kind: r.kind, grams: Number(r.grams) }));
}

/** Orders whose folio, note, customer or items match the text (newest first), searched in SQL. */
export async function searchOrders(ex: Executor, ctx: Ctx, q: string, limit = 8): Promise<OrderRow[]> {
  const folio = /^#?\d+$/.test(q.trim()) ? Number(q.trim().replace('#', '')) : null;
  return ex.select().from(order).where(and(inWorkspace(order.workspaceId, ctx), isNull(order.deletedAt), or(
    folio !== null ? eq(order.number, folio) : undefined, ilike(order.note, likePattern(q)),
    sql`exists (select 1 from ${customer} c where c.workspace_id = ${ctx.workspaceId} and c.id = ${order.customerId} and c.name ilike ${likePattern(q)})`,
    sql`exists (select 1 from ${lineItem} li where li.workspace_id = ${ctx.workspaceId} and li.parent_kind = 'order' and li.parent_id = ${order.id} and li.name ilike ${likePattern(q)})`,
  ))).orderBy(desc(order.number)).limit(limit);
}

/** Per customer: orders, active orders, owed of active orders and last order date, in SQL (docs/04 §7, §12). */
export async function orderTotalsByCustomer(ex: Executor, ctx: Ctx) {
  const it = ex.select({ parentId: lineItem.parentId, gross: sql<string>`sum(${lineItem.qty} * ${lineItem.priceCents})`.as('gross') }).from(lineItem)
    .where(and(eq(lineItem.workspaceId, ctx.workspaceId), eq(lineItem.parentKind, 'order'))).groupBy(lineItem.parentId).as('it');
  const pa = ex.select({ parentId: payment.parentId, paid: sql<string>`sum(${payment.amountCents})`.as('paid') }).from(payment)
    .where(and(eq(payment.workspaceId, ctx.workspaceId), eq(payment.parentKind, 'order'))).groupBy(payment.parentId).as('pa');
  const active = sql`${order.status} not in ('delivered', 'cancelled')`;
  const rows = await ex.select({
    customerId: order.customerId, n: count(), active: sql<string>`count(*) filter (where ${active})`,
    owed: sql<string>`coalesce(sum(case when ${active} then greatest(0, coalesce(${it.gross}, 0) - coalesce(${pa.paid}, 0)) else 0 end), 0)`,
    lastOn: sql<string | null>`max(coalesce(${order.createdOn}, ${order.dueOn}))`,
  }).from(order).leftJoin(it, eq(it.parentId, order.id)).leftJoin(pa, eq(pa.parentId, order.id))
    .where(and(inWorkspace(order.workspaceId, ctx), isNull(order.deletedAt))).groupBy(order.customerId);
  return new Map(rows.map((r) => [r.customerId, { orders: r.n, active: Number(r.active), owedCents: Number(r.owed), lastOn: r.lastOn }]));
}

/**
 * Pieces sold in a period for the ranking (docs/04 §3, §13): pieces as they are, sets opened into their parts with the
 * income split by list price (extras of the set go with the same share). Returned sales do not count. All in SQL.
 */
export async function productLines(ex: Executor, ctx: Ctx, f: { from?: string | undefined; to?: string | undefined }) {
  inWorkspace(sale.workspaceId, ctx);
  const range = sql`s.workspace_id = ${ctx.workspaceId} and s.deleted_at is null and s.return is null ${f.from ? sql`and s."on" >= ${f.from}` : sql``} ${f.to ? sql`and s."on" <= ${f.to}` : sql``}`;
  const res = await ex.execute(sql`
    with li as (
      select li.kind, li.product_id, li.collection_id, li.name, li.qty, li.price_cents, li.cost_cents, li.extras_cents, li.parts, coalesce(ch.commission_pct, 0) as cm
      from ${lineItem} li join ${sale} s on s.workspace_id = li.workspace_id and s.id = li.parent_id
      left join ${salesChannel} ch on ch.workspace_id = s.workspace_id and ch.id = s.channel_id
      where li.workspace_id = ${ctx.workspaceId} and li.parent_kind = 'sale' and ${range}
    ), parts as (
      select li.*, p, (select count(*) from jsonb_array_elements(li.parts)) as n,
        (select sum(greatest(0, (x->>'listCents')::numeric) * (x->>'qty')::int) from jsonb_array_elements(li.parts) x) as w
      from li, jsonb_array_elements(li.parts) p where li.kind = 'set'
    ), lines as (
      select product_id::text as product_id, name, qty::numeric as qty, (qty * price_cents)::numeric as income, (qty * cost_cents)::numeric as cost, cm from li where kind = 'piece'
      union all
      select p->>'productId', p->>'name', ((p->>'qty')::int * qty)::numeric,
        qty * price_cents * (case when w > 0 then greatest(0, (p->>'listCents')::numeric) * (p->>'qty')::int / w else 1.0 / n end),
        (p->>'qty')::int * qty * (p->>'costCents')::numeric + extras_cents * qty * (case when w > 0 then greatest(0, (p->>'listCents')::numeric) * (p->>'qty')::int / w else 1.0 / n end), cm
      from parts
    )
    select product_id, min(name) as name, sum(qty) as qty, sum(income) as income, sum(cost) as cost, sum(income * (1 - cm / 100) - cost) as profit
    from lines group by product_id`);
  return ((res as unknown as { rows: Record<string, string>[] }).rows).map((r) => ({ productId: r.product_id!, name: r.name ?? '', qty: Number(r.qty), incomeCents: Number(r.income), costCents: Number(r.cost), profitCents: Number(r.profit) }));
}

/** Sets sold per collection in a period (income, cost and profit after commission), in SQL. */
export async function collectionLines(ex: Executor, ctx: Ctx, f: { from?: string | undefined; to?: string | undefined }) {
  const rows = await ex.select({
    id: lineItem.collectionId, name: sql<string>`min(${lineItem.name})`, qty: sql<string>`sum(${lineItem.qty})`, income: sql<string>`sum(${lineItem.qty} * ${lineItem.priceCents})`,
    cost: sql<string>`sum(${lineItem.qty} * ${lineItem.costCents})`, profit: sql<string>`sum(${lineItem.qty} * ${lineItem.priceCents} * (1 - coalesce(${salesChannel.commissionPct}, 0) / 100) - ${lineItem.qty} * ${lineItem.costCents})`,
  }).from(lineItem).innerJoin(sale, and(eq(sale.workspaceId, lineItem.workspaceId), eq(sale.id, lineItem.parentId)))
    .leftJoin(salesChannel, and(eq(salesChannel.workspaceId, sale.workspaceId), eq(salesChannel.id, sale.channelId)))
    .where(and(inWorkspace(lineItem.workspaceId, ctx), eq(lineItem.parentKind, 'sale'), eq(lineItem.kind, 'set'), isNull(sale.deletedAt), isNull(sale.return),
      f.from ? gte(sale.on, f.from) : undefined, f.to ? lte(sale.on, f.to) : undefined))
    .groupBy(lineItem.collectionId);
  return rows.filter((r) => r.id).map((r) => ({ id: r.id!, name: r.name, qty: Number(r.qty), incomeCents: Number(r.income), costCents: Number(r.cost), profitCents: Number(r.profit) }));
}
