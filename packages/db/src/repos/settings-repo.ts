import { asc, eq } from 'drizzle-orm';
import { assertCtx, type Ctx } from '../ctx';
import type { Executor } from '../connect';
import { newId } from '../ids';
import { catalogItem, salesChannel, workspaceSettings, type BusinessInfo } from '../schema';
import { now, scope, scopeAll } from './helpers';

export type SettingsRow = typeof workspaceSettings.$inferSelect;
export type ChannelRow = typeof salesChannel.$inferSelect;
export type CatalogItemRow = typeof catalogItem.$inferSelect;
export type CatalogKind = CatalogItemRow['kind'];
export type { BusinessInfo };

export const settingsRepo = {
  async get(ex: Executor, ctx: Ctx): Promise<SettingsRow | undefined> {
    const [row] = await ex.select().from(workspaceSettings).where(eq(workspaceSettings.workspaceId, assertCtx(ctx)));
    return row;
  },
  async upsert(
    ex: Executor,
    ctx: Ctx,
    data: Pick<SettingsRow, 'kwhPriceCents' | 'failurePct' | 'purgePct' | 'minMarginPct' | 'formulaMarginPct' | 'business'>,
  ): Promise<SettingsRow> {
    const ws = assertCtx(ctx);
    const [row] = await ex
      .insert(workspaceSettings)
      .values({ workspaceId: ws, ...data })
      .onConflictDoUpdate({ target: workspaceSettings.workspaceId, set: { ...data, updatedAt: now() } })
      .returning();
    return row!;
  },

  async listChannels(ex: Executor, ctx: Ctx): Promise<ChannelRow[]> {
    return ex.select().from(salesChannel).where(scope(ctx, salesChannel)).orderBy(asc(salesChannel.position), asc(salesChannel.createdAt));
  },
  async getChannel(ex: Executor, ctx: Ctx, id: string, withDeleted = false): Promise<ChannelRow | undefined> {
    const [row] = await ex.select().from(salesChannel).where(withDeleted ? scopeAll(ctx, salesChannel, eq(salesChannel.id, id)) : scope(ctx, salesChannel, eq(salesChannel.id, id)));
    return row;
  },
  async insertChannel(ex: Executor, ctx: Ctx, data: { name: string; nameKey: string; commissionPct: number; position: number }): Promise<ChannelRow> {
    const [row] = await ex.insert(salesChannel).values({ id: newId(), workspaceId: assertCtx(ctx), ...data }).returning();
    return row!;
  },
  async updateChannel(ex: Executor, ctx: Ctx, id: string, data: Partial<Pick<ChannelRow, 'name' | 'nameKey' | 'commissionPct' | 'position' | 'deletedAt'>>): Promise<void> {
    await ex.update(salesChannel).set({ ...data, updatedAt: now() }).where(scopeAll(ctx, salesChannel, eq(salesChannel.id, id)));
  },

  async listCatalog(ex: Executor, ctx: Ctx): Promise<CatalogItemRow[]> {
    return ex.select().from(catalogItem).where(scope(ctx, catalogItem)).orderBy(asc(catalogItem.kind), asc(catalogItem.createdAt));
  },
  /** Adds the item if its (kind, name_key) is not there yet. */
  async addCatalogItem(ex: Executor, ctx: Ctx, data: { kind: CatalogKind; name: string; nameKey: string; hex?: string | null }): Promise<void> {
    await ex
      .insert(catalogItem)
      .values({ id: newId(), workspaceId: assertCtx(ctx), kind: data.kind, name: data.name, nameKey: data.nameKey, hex: data.hex ?? null })
      .onConflictDoNothing();
  },
};
