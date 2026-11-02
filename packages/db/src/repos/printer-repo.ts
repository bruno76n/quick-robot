import { asc, eq, inArray } from 'drizzle-orm';
import { assertCtx, type Ctx } from '../ctx';
import type { Executor } from '../connect';
import { newId } from '../ids';
import { maintenanceTask, printer } from '../schema';
import { now, scope, scopeAll } from './helpers';

export type PrinterRow = typeof printer.$inferSelect;
export type MaintenanceTaskRow = typeof maintenanceTask.$inferSelect;
type PrinterData = Pick<PrinterRow, 'name' | 'costCents' | 'lifeHours' | 'maintenanceCentsPerHour' | 'kw' | 'hours' | 'purchasedOn'>;
type TaskData = Pick<MaintenanceTaskRow, 'task' | 'everyHours'>;

export const printerRepo = {
  list: (ex: Executor, ctx: Ctx): Promise<PrinterRow[]> => ex.select().from(printer).where(scope(ctx, printer)).orderBy(asc(printer.createdAt), asc(printer.id)),
  async get(ex: Executor, ctx: Ctx, id: string): Promise<PrinterRow | undefined> {
    const [row] = await ex.select().from(printer).where(scope(ctx, printer, eq(printer.id, id)));
    return row;
  },
  async insert(ex: Executor, ctx: Ctx, data: PrinterData): Promise<PrinterRow> {
    const [row] = await ex.insert(printer).values({ id: newId(), workspaceId: assertCtx(ctx), ...data }).returning();
    return row!;
  },
  async update(ex: Executor, ctx: Ctx, id: string, data: Partial<PrinterData>): Promise<number> {
    const r = await ex.update(printer).set({ ...data, updatedAt: now() }).where(scope(ctx, printer, eq(printer.id, id))).returning({ id: printer.id });
    return r.length;
  },
  async setDeleted(ex: Executor, ctx: Ctx, id: string, deleted: boolean): Promise<number> {
    const r = await ex.update(printer).set({ deletedAt: deleted ? now() : null, updatedAt: now() }).where(scopeAll(ctx, printer, eq(printer.id, id))).returning({ id: printer.id });
    return r.length;
  },

  listTasks: (ex: Executor, ctx: Ctx, printerIds?: readonly string[]): Promise<MaintenanceTaskRow[]> =>
    printerIds && printerIds.length === 0
      ? Promise.resolve([])
      : ex
          .select()
          .from(maintenanceTask)
          .where(scope(ctx, maintenanceTask, printerIds ? inArray(maintenanceTask.printerId, [...printerIds]) : undefined))
          .orderBy(asc(maintenanceTask.position), asc(maintenanceTask.createdAt)),
  async getTask(ex: Executor, ctx: Ctx, id: string): Promise<MaintenanceTaskRow | undefined> {
    const [row] = await ex.select().from(maintenanceTask).where(scope(ctx, maintenanceTask, eq(maintenanceTask.id, id)));
    return row;
  },
  async insertTask(ex: Executor, ctx: Ctx, data: TaskData & { printerId: string; lastHours: number; position: number }): Promise<MaintenanceTaskRow> {
    const [row] = await ex.insert(maintenanceTask).values({ id: newId(), workspaceId: assertCtx(ctx), ...data }).returning();
    return row!;
  },
  async updateTask(ex: Executor, ctx: Ctx, id: string, data: Partial<TaskData & Pick<MaintenanceTaskRow, 'lastHours' | 'lastOn'>>): Promise<number> {
    const r = await ex.update(maintenanceTask).set({ ...data, updatedAt: now() }).where(scope(ctx, maintenanceTask, eq(maintenanceTask.id, id))).returning({ id: maintenanceTask.id });
    return r.length;
  },
  async setTaskDeleted(ex: Executor, ctx: Ctx, id: string, deleted: boolean): Promise<number> {
    const r = await ex
      .update(maintenanceTask)
      .set({ deletedAt: deleted ? now() : null, updatedAt: now() })
      .where(scopeAll(ctx, maintenanceTask, eq(maintenanceTask.id, id)))
      .returning({ id: maintenanceTask.id });
    return r.length;
  },
};
