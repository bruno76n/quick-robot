// Printers, maintenance tasks and expenses. Every function takes ctx.
import { and, asc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import type { Ctx } from '../ctx';
import type { Executor } from '../db';
import { expense, maintenanceTask, printer } from '../schema';
import { inWorkspace } from './scope';

export type PrinterRow = typeof printer.$inferSelect;
export type MaintenanceTaskRow = typeof maintenanceTask.$inferSelect;
export type ExpenseRow = typeof expense.$inferSelect;
type NewRow<T extends { $inferInsert: object }> = Omit<T['$inferInsert'], 'workspaceId' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

export async function listPrinters(ex: Executor, ctx: Ctx): Promise<PrinterRow[]> {
  return ex.select().from(printer).where(and(inWorkspace(printer.workspaceId, ctx), isNull(printer.deletedAt))).orderBy(asc(printer.createdAt), asc(printer.id));
}

export async function getPrinter(ex: Executor, ctx: Ctx, id: string, opts: { deleted?: boolean; forUpdate?: boolean } = {}): Promise<PrinterRow | undefined> {
  const q = ex.select().from(printer).where(and(inWorkspace(printer.workspaceId, ctx), eq(printer.id, id), opts.deleted ? isNotNull(printer.deletedAt) : isNull(printer.deletedAt)));
  const [r] = opts.forUpdate ? await q.for('update') : await q;
  return r;
}

export async function insertPrinter(ex: Executor, ctx: Ctx, row: NewRow<typeof printer>) {
  inWorkspace(printer.workspaceId, ctx);
  const [r] = await ex.insert(printer).values({ ...row, workspaceId: ctx.workspaceId }).returning();
  return r!;
}

export async function updatePrinter(ex: Executor, ctx: Ctx, id: string, patch: Partial<NewRow<typeof printer>>) {
  const [r] = await ex.update(printer).set({ ...patch, updatedAt: new Date() }).where(and(inWorkspace(printer.workspaceId, ctx), eq(printer.id, id), isNull(printer.deletedAt))).returning();
  return r;
}

/** Adds (or subtracts) worked hours; never below 0. */
export async function addPrinterHours(ex: Executor, ctx: Ctx, id: string, hours: number) {
  await ex.update(printer).set({ hours: sql`greatest(0, ${printer.hours} + ${hours})`, updatedAt: new Date() }).where(and(inWorkspace(printer.workspaceId, ctx), eq(printer.id, id)));
}

export async function setPrinterDeleted(ex: Executor, ctx: Ctx, id: string, deletedAt: Date | null) {
  const [r] = await ex.update(printer).set({ deletedAt, updatedAt: new Date() }).where(and(inWorkspace(printer.workspaceId, ctx), eq(printer.id, id), deletedAt ? isNull(printer.deletedAt) : isNotNull(printer.deletedAt))).returning();
  return r;
}

export async function listTasks(ex: Executor, ctx: Ctx, printerIds?: readonly string[]): Promise<MaintenanceTaskRow[]> {
  const rows = await ex.select().from(maintenanceTask).where(inWorkspace(maintenanceTask.workspaceId, ctx)).orderBy(asc(maintenanceTask.position), asc(maintenanceTask.createdAt), asc(maintenanceTask.id));
  return printerIds ? rows.filter((r) => printerIds.includes(r.printerId)) : rows;
}

export async function getTask(ex: Executor, ctx: Ctx, printerId: string, id: string): Promise<MaintenanceTaskRow | undefined> {
  const [r] = await ex.select().from(maintenanceTask).where(and(inWorkspace(maintenanceTask.workspaceId, ctx), eq(maintenanceTask.printerId, printerId), eq(maintenanceTask.id, id)));
  return r;
}

export async function insertTasks(ex: Executor, ctx: Ctx, rows: readonly NewRow<typeof maintenanceTask>[]) {
  inWorkspace(maintenanceTask.workspaceId, ctx);
  if (!rows.length) return [];
  return ex.insert(maintenanceTask).values(rows.map((r) => ({ ...r, workspaceId: ctx.workspaceId }))).returning();
}

export async function updateTask(ex: Executor, ctx: Ctx, id: string, patch: Partial<NewRow<typeof maintenanceTask>>) {
  const [r] = await ex.update(maintenanceTask).set({ ...patch, updatedAt: new Date() }).where(and(inWorkspace(maintenanceTask.workspaceId, ctx), eq(maintenanceTask.id, id))).returning();
  return r;
}

export async function deleteTask(ex: Executor, ctx: Ctx, id: string) {
  await ex.delete(maintenanceTask).where(and(inWorkspace(maintenanceTask.workspaceId, ctx), eq(maintenanceTask.id, id)));
}

export async function insertExpense(ex: Executor, ctx: Ctx, row: NewRow<typeof expense>) {
  inWorkspace(expense.workspaceId, ctx);
  const [r] = await ex.insert(expense).values({ ...row, workspaceId: ctx.workspaceId }).returning();
  return r!;
}
