// Suppliers, supplies and the supply ledger. Every function takes ctx.
import { and, asc, count, desc, eq, ilike, inArray, isNotNull, isNull, ne, or } from 'drizzle-orm';
import type { Ctx } from '../ctx';
import type { Executor } from '../db';
import { product, productSupply, supplier, supply, supplyLevels, supplyMovement } from '../schema';
import { inWorkspace, likePattern } from './scope';

export type SupplierRow = typeof supplier.$inferSelect;
export type SupplyRow = typeof supply.$inferSelect & { stock: number };
export type SupplyMovementRow = typeof supplyMovement.$inferSelect;
type NewRow<T extends { $inferInsert: object }> = Omit<T['$inferInsert'], 'workspaceId' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

export async function listSuppliers(ex: Executor, ctx: Ctx, opts: { withDeleted?: boolean } = {}): Promise<SupplierRow[]> {
  return ex.select().from(supplier).where(and(inWorkspace(supplier.workspaceId, ctx), opts.withDeleted ? undefined : isNull(supplier.deletedAt))).orderBy(asc(supplier.name), asc(supplier.id));
}

export async function getSupplier(ex: Executor, ctx: Ctx, id: string, opts: { deleted?: boolean } = {}): Promise<SupplierRow | undefined> {
  const [r] = await ex.select().from(supplier).where(and(inWorkspace(supplier.workspaceId, ctx), eq(supplier.id, id), opts.deleted ? isNotNull(supplier.deletedAt) : isNull(supplier.deletedAt)));
  return r;
}

export async function insertSupplier(ex: Executor, ctx: Ctx, row: NewRow<typeof supplier>) {
  inWorkspace(supplier.workspaceId, ctx);
  const [r] = await ex.insert(supplier).values({ ...row, workspaceId: ctx.workspaceId }).returning();
  return r!;
}

export async function updateSupplier(ex: Executor, ctx: Ctx, id: string, patch: Partial<NewRow<typeof supplier>>) {
  const [r] = await ex.update(supplier).set({ ...patch, updatedAt: new Date() }).where(and(inWorkspace(supplier.workspaceId, ctx), eq(supplier.id, id), isNull(supplier.deletedAt))).returning();
  return r;
}

export async function setSupplierDeleted(ex: Executor, ctx: Ctx, id: string, deletedAt: Date | null) {
  const [r] = await ex.update(supplier).set({ deletedAt, updatedAt: new Date() }).where(and(inWorkspace(supplier.workspaceId, ctx), eq(supplier.id, id), deletedAt ? isNull(supplier.deletedAt) : isNotNull(supplier.deletedAt))).returning();
  return r;
}

const supplyWithStock = { s: supply, stock: supplyLevels.stock };

export async function listSupplies(ex: Executor, ctx: Ctx, opts: { q?: string | undefined; page: number; pageSize: number }) {
  const where = and(inWorkspace(supply.workspaceId, ctx), isNull(supply.deletedAt), opts.q ? or(ilike(supply.name, likePattern(opts.q)), ilike(supply.note, likePattern(opts.q))) : undefined);
  const [total] = await ex.select({ n: count() }).from(supply).where(where);
  const rows = await ex.select(supplyWithStock).from(supply)
    .innerJoin(supplyLevels, and(eq(supplyLevels.workspaceId, supply.workspaceId), eq(supplyLevels.supplyId, supply.id)))
    .where(where).orderBy(asc(supply.createdAt), asc(supply.id)).limit(opts.pageSize).offset((opts.page - 1) * opts.pageSize);
  return { items: rows.map((r) => ({ ...r.s, stock: Number(r.stock) })), total: total?.n ?? 0 };
}

export async function getSupply(ex: Executor, ctx: Ctx, id: string, opts: { deleted?: boolean; forUpdate?: boolean } = {}): Promise<SupplyRow | undefined> {
  const where = and(inWorkspace(supply.workspaceId, ctx), eq(supply.id, id), opts.deleted ? isNotNull(supply.deletedAt) : isNull(supply.deletedAt));
  if (opts.forUpdate) await ex.select({ id: supply.id }).from(supply).where(where).for('update');
  const [r] = await ex.select({ s: supply }).from(supply).where(where);
  if (!r) return undefined;
  const all = await ex.select({ q: supplyMovement.qty }).from(supplyMovement).where(and(eq(supplyMovement.workspaceId, ctx.workspaceId), eq(supplyMovement.supplyId, id)));
  return { ...r.s, stock: Math.round(all.reduce((a, m) => a + Number(m.q), 0) * 100) / 100 };
}

export async function getSuppliesByIds(ex: Executor, ctx: Ctx, ids: readonly string[]) {
  if (!ids.length) return [];
  return ex.select().from(supply).where(and(inWorkspace(supply.workspaceId, ctx), inArray(supply.id, [...ids])));
}

export async function findSupplyByKey(ex: Executor, ctx: Ctx, nameKey: string, exceptId?: string) {
  const [r] = await ex.select().from(supply).where(and(inWorkspace(supply.workspaceId, ctx), eq(supply.nameKey, nameKey), isNull(supply.deletedAt), exceptId ? ne(supply.id, exceptId) : undefined));
  return r;
}

export async function insertSupply(ex: Executor, ctx: Ctx, row: NewRow<typeof supply>) {
  inWorkspace(supply.workspaceId, ctx);
  const [r] = await ex.insert(supply).values({ ...row, workspaceId: ctx.workspaceId }).returning();
  return r!;
}

export async function updateSupply(ex: Executor, ctx: Ctx, id: string, patch: Partial<NewRow<typeof supply>>) {
  const [r] = await ex.update(supply).set({ ...patch, updatedAt: new Date() }).where(and(inWorkspace(supply.workspaceId, ctx), eq(supply.id, id), isNull(supply.deletedAt))).returning();
  return r;
}

export async function setSupplyDeleted(ex: Executor, ctx: Ctx, id: string, deletedAt: Date | null) {
  const [r] = await ex.update(supply).set({ deletedAt, updatedAt: new Date() }).where(and(inWorkspace(supply.workspaceId, ctx), eq(supply.id, id), deletedAt ? isNull(supply.deletedAt) : isNotNull(supply.deletedAt))).returning();
  return r;
}

export async function insertSupplyMovements(ex: Executor, ctx: Ctx, rows: readonly Omit<typeof supplyMovement.$inferInsert, 'workspaceId' | 'createdAt'>[]) {
  inWorkspace(supplyMovement.workspaceId, ctx);
  if (!rows.length) return [];
  return ex.insert(supplyMovement).values(rows.map((r) => ({ ...r, workspaceId: ctx.workspaceId }))).returning();
}

export async function listSupplyMovements(ex: Executor, ctx: Ctx, supplyId: string, limit = 200): Promise<SupplyMovementRow[]> {
  return ex.select().from(supplyMovement).where(and(inWorkspace(supplyMovement.workspaceId, ctx), eq(supplyMovement.supplyId, supplyId)))
    .orderBy(desc(supplyMovement.on), desc(supplyMovement.createdAt), desc(supplyMovement.id)).limit(limit);
}

/** Live pieces that use a supply (SUPPLY_IN_USE and the drawer list). */
export async function productsUsingSupply(ex: Executor, ctx: Ctx, supplyId: string) {
  return ex.select({ id: product.id, name: product.name, qty: productSupply.qty }).from(productSupply)
    .innerJoin(product, and(eq(product.workspaceId, productSupply.workspaceId), eq(product.id, productSupply.productId)))
    .where(and(inWorkspace(productSupply.workspaceId, ctx), eq(productSupply.supplyId, supplyId), isNull(product.deletedAt)))
    .orderBy(asc(product.name));
}
