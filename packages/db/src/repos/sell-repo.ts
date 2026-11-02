// Stock, customers, orders, sales, line items, payments, print runs, queues and expenses. Every function takes ctx.
import { and, asc, count, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, ne, or, sql, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { Ctx } from '../ctx';
import type { Executor } from '../db';
import { customer, expense, lineItem, order, payment, printQueueEntry, printRun, printRunFilament, sale, spoolMovement, stockLevels, stockMovement, supplyMovement, workspace } from '../schema';
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
export async function listOrders(ex: Executor, ctx: Ctx, f: OrderFilter = {}): Promise<OrderRow[]> {
  if (f.ids && !f.ids.length) return [];
  return ex.select().from(order).where(and(
    inWorkspace(order.workspaceId, ctx), isNull(order.deletedAt),
    f.statuses ? inArray(order.status, [...f.statuses]) : undefined, f.customerId ? eq(order.customerId, f.customerId) : undefined,
    f.ids ? inArray(order.id, [...f.ids]) : undefined, f.dueFrom ? gte(order.dueOn, f.dueFrom) : undefined, f.dueTo ? lte(order.dueOn, f.dueTo) : undefined,
  )).orderBy(asc(order.number));
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
export interface SaleFilter { from?: string | undefined; to?: string | undefined; channelId?: string | undefined; customerId?: string | undefined; orderId?: string | undefined; ids?: readonly string[] | undefined }
const saleWhere = (ctx: Ctx, f: SaleFilter): SQL | undefined => and(
  inWorkspace(sale.workspaceId, ctx), isNull(sale.deletedAt),
  f.from ? gte(sale.on, f.from) : undefined, f.to ? lte(sale.on, f.to) : undefined, f.channelId ? eq(sale.channelId, f.channelId) : undefined,
  f.customerId ? eq(sale.customerId, f.customerId) : undefined, f.orderId ? eq(sale.orderId, f.orderId) : undefined, f.ids ? inArray(sale.id, [...f.ids]) : undefined,
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

export async function listPrintRuns(ex: Executor, ctx: Ctx, f: { reason?: string | undefined; productId?: string | undefined; orderId?: string | undefined } = {}): Promise<PrintRunRow[]> {
  return ex.select().from(printRun).where(and(
    inWorkspace(printRun.workspaceId, ctx), f.reason ? eq(printRun.reason, f.reason) : undefined,
    f.productId ? eq(printRun.productId, f.productId) : undefined, f.orderId ? eq(printRun.orderId, f.orderId) : undefined,
  )).orderBy(desc(printRun.on), desc(printRun.createdAt), desc(printRun.id));
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
