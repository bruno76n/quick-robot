import { asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { assertCtx, type Ctx } from '../ctx';
import type { Executor } from '../connect';
import { newId } from '../ids';
import { productSupply, product, supply, supplyMovement } from '../schema';
import { now, scope, scopeAll } from './helpers';

export type SupplyRow = typeof supply.$inferSelect;
export type SupplyMovementRow = typeof supplyMovement.$inferSelect;
type SupplyData = Pick<SupplyRow, 'name' | 'nameKey' | 'unit' | 'costCents' | 'minimum' | 'note' | 'supplierId'>;

export const supplyRepo = {
  /** In the order they were created (as the mockup lists them). */
  list: (ex: Executor, ctx: Ctx): Promise<SupplyRow[]> => ex.select().from(supply).where(scope(ctx, supply)).orderBy(asc(supply.createdAt), asc(supply.id)),
  async get(ex: Executor, ctx: Ctx, id: string): Promise<SupplyRow | undefined> {
    const [row] = await ex.select().from(supply).where(scope(ctx, supply, eq(supply.id, id)));
    return row;
  },
  async findByKey(ex: Executor, ctx: Ctx, nameKey: string): Promise<SupplyRow | undefined> {
    const [row] = await ex.select().from(supply).where(scope(ctx, supply, eq(supply.nameKey, nameKey)));
    return row;
  },
  async insert(ex: Executor, ctx: Ctx, data: SupplyData): Promise<SupplyRow> {
    const [row] = await ex.insert(supply).values({ id: newId(), workspaceId: assertCtx(ctx), ...data }).returning();
    return row!;
  },
  async update(ex: Executor, ctx: Ctx, id: string, data: Partial<SupplyData>): Promise<number> {
    const r = await ex.update(supply).set({ ...data, updatedAt: now() }).where(scope(ctx, supply, eq(supply.id, id))).returning({ id: supply.id });
    return r.length;
  },
  async setDeleted(ex: Executor, ctx: Ctx, id: string, deleted: boolean): Promise<number> {
    const r = await ex.update(supply).set({ deletedAt: deleted ? now() : null, updatedAt: now() }).where(scopeAll(ctx, supply, eq(supply.id, id))).returning({ id: supply.id });
    return r.length;
  },
  async insertMovement(ex: Executor, ctx: Ctx, data: Pick<SupplyMovementRow, 'supplyId' | 'on' | 'kind' | 'qty' | 'note'> & { refId?: string | null }): Promise<SupplyMovementRow> {
    const [row] = await ex.insert(supplyMovement).values({ id: newId(), workspaceId: assertCtx(ctx), refId: data.refId ?? null, supplyId: data.supplyId, on: data.on, kind: data.kind, qty: data.qty, note: data.note }).returning();
    return row!;
  },
  /** Σ qty per supply (stock). */
  async stockBySupply(ex: Executor, ctx: Ctx): Promise<Map<string, number>> {
    const rows = await ex
      .select({ supplyId: supplyMovement.supplyId, qty: sql<string>`sum(${supplyMovement.qty})` })
      .from(supplyMovement)
      .where(eq(supplyMovement.workspaceId, assertCtx(ctx)))
      .groupBy(supplyMovement.supplyId);
    return new Map(rows.map((r) => [r.supplyId, Number(r.qty)]));
  },
  async listMovements(ex: Executor, ctx: Ctx, supplyId: string, limit = 14): Promise<SupplyMovementRow[]> {
    return ex
      .select()
      .from(supplyMovement)
      .where(scopeAll(ctx, supplyMovement, eq(supplyMovement.supplyId, supplyId)))
      .orderBy(desc(supplyMovement.on), desc(supplyMovement.id))
      .limit(limit);
  },
  /** Live products that use these supplies (for "Usado en" and to block deletion). */
  async usedBy(ex: Executor, ctx: Ctx, supplyIds: readonly string[]): Promise<{ supplyId: string; productId: string; productName: string; qty: number }[]> {
    if (supplyIds.length === 0) return [];
    return ex
      .select({ supplyId: productSupply.supplyId, productId: product.id, productName: product.name, qty: productSupply.qty })
      .from(productSupply)
      .innerJoin(product, sql`${product.workspaceId} = ${productSupply.workspaceId} and ${product.id} = ${productSupply.productId}`)
      .where(scope(ctx, product, inArray(productSupply.supplyId, [...supplyIds])))
      .orderBy(asc(product.name));
  },
};
