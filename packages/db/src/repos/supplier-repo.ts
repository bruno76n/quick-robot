import { asc, eq } from 'drizzle-orm';
import { assertCtx, type Ctx } from '../ctx';
import type { Executor } from '../connect';
import { newId } from '../ids';
import { supplier } from '../schema';
import { now, scope, scopeAll } from './helpers';

export type SupplierRow = typeof supplier.$inferSelect;
type SupplierData = Pick<SupplierRow, 'name' | 'phone' | 'brands' | 'note'>;

export const supplierRepo = {
  list: (ex: Executor, ctx: Ctx): Promise<SupplierRow[]> => ex.select().from(supplier).where(scope(ctx, supplier)).orderBy(asc(supplier.name)),
  async get(ex: Executor, ctx: Ctx, id: string): Promise<SupplierRow | undefined> {
    const [row] = await ex.select().from(supplier).where(scope(ctx, supplier, eq(supplier.id, id)));
    return row;
  },
  async insert(ex: Executor, ctx: Ctx, data: SupplierData): Promise<SupplierRow> {
    const [row] = await ex.insert(supplier).values({ id: newId(), workspaceId: assertCtx(ctx), ...data }).returning();
    return row!;
  },
  async update(ex: Executor, ctx: Ctx, id: string, data: SupplierData): Promise<number> {
    const r = await ex.update(supplier).set({ ...data, updatedAt: now() }).where(scope(ctx, supplier, eq(supplier.id, id))).returning({ id: supplier.id });
    return r.length;
  },
  async setDeleted(ex: Executor, ctx: Ctx, id: string, deleted: boolean): Promise<number> {
    const r = await ex.update(supplier).set({ deletedAt: deleted ? now() : null, updatedAt: now() }).where(scopeAll(ctx, supplier, eq(supplier.id, id))).returning({ id: supplier.id });
    return r.length;
  },
};
