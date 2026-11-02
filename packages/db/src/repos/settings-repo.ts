// Settings, sales channels, pick lists and files. Every function takes ctx.
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Ctx } from '../ctx';
import type { Executor } from '../db';
import { catalogItem, file, salesChannel, workspaceSettings, type BusinessData } from '../schema';
import { inWorkspace } from './scope';

export type SettingsRow = typeof workspaceSettings.$inferSelect;
export type ChannelRow = typeof salesChannel.$inferSelect;
export type CatalogRow = typeof catalogItem.$inferSelect;
export type FileRow = typeof file.$inferSelect;
export type { BusinessData };

export async function getSettings(ex: Executor, ctx: Ctx): Promise<SettingsRow | undefined> {
  const [row] = await ex.select().from(workspaceSettings).where(inWorkspace(workspaceSettings.workspaceId, ctx));
  return row;
}

export async function insertSettings(ex: Executor, ctx: Ctx, row: Omit<typeof workspaceSettings.$inferInsert, 'workspaceId'>) {
  inWorkspace(workspaceSettings.workspaceId, ctx);
  await ex.insert(workspaceSettings).values({ ...row, workspaceId: ctx.workspaceId }).onConflictDoNothing();
}

export async function updateSettings(ex: Executor, ctx: Ctx, patch: Partial<Omit<typeof workspaceSettings.$inferInsert, 'workspaceId'>>) {
  const [row] = await ex.update(workspaceSettings).set({ ...patch, updatedAt: new Date() }).where(inWorkspace(workspaceSettings.workspaceId, ctx)).returning();
  return row;
}

export async function listChannels(ex: Executor, ctx: Ctx): Promise<ChannelRow[]> {
  return ex.select().from(salesChannel).where(inWorkspace(salesChannel.workspaceId, ctx)).orderBy(asc(salesChannel.position), asc(salesChannel.id));
}

export async function getChannel(ex: Executor, ctx: Ctx, id: string): Promise<ChannelRow | undefined> {
  const [row] = await ex.select().from(salesChannel).where(and(inWorkspace(salesChannel.workspaceId, ctx), eq(salesChannel.id, id)));
  return row;
}

export async function insertChannel(ex: Executor, ctx: Ctx, row: Omit<typeof salesChannel.$inferInsert, 'workspaceId'>) {
  inWorkspace(salesChannel.workspaceId, ctx);
  const [r] = await ex.insert(salesChannel).values({ ...row, workspaceId: ctx.workspaceId }).returning();
  return r!;
}

export async function updateChannel(ex: Executor, ctx: Ctx, id: string, patch: Partial<Pick<ChannelRow, 'name' | 'nameKey' | 'commissionPct' | 'position'>>) {
  const [r] = await ex.update(salesChannel).set({ ...patch, updatedAt: new Date() }).where(and(inWorkspace(salesChannel.workspaceId, ctx), eq(salesChannel.id, id))).returning();
  return r;
}

export async function deleteChannel(ex: Executor, ctx: Ctx, id: string) {
  await ex.delete(salesChannel).where(and(inWorkspace(salesChannel.workspaceId, ctx), eq(salesChannel.id, id)));
}

export async function listCatalog(ex: Executor, ctx: Ctx, kinds?: readonly string[]): Promise<CatalogRow[]> {
  return ex.select().from(catalogItem)
    .where(and(inWorkspace(catalogItem.workspaceId, ctx), kinds ? inArray(catalogItem.kind, [...kinds]) : undefined))
    .orderBy(asc(catalogItem.kind), asc(catalogItem.createdAt), asc(catalogItem.id));
}

/** Adds entries that are not there yet (by normalized key); existing ones are left as they are. */
export async function addCatalogItems(ex: Executor, ctx: Ctx, rows: readonly Omit<typeof catalogItem.$inferInsert, 'workspaceId'>[]) {
  inWorkspace(catalogItem.workspaceId, ctx);
  if (!rows.length) return;
  await ex.insert(catalogItem).values(rows.map((r) => ({ ...r, workspaceId: ctx.workspaceId }))).onConflictDoNothing();
}

export async function insertFile(ex: Executor, ctx: Ctx, row: Omit<typeof file.$inferInsert, 'workspaceId'>): Promise<FileRow> {
  inWorkspace(file.workspaceId, ctx);
  const [r] = await ex.insert(file).values({ ...row, workspaceId: ctx.workspaceId }).returning();
  return r!;
}

export async function getFile(ex: Executor, ctx: Ctx, id: string): Promise<FileRow | undefined> {
  const [r] = await ex.select().from(file).where(and(inWorkspace(file.workspaceId, ctx), eq(file.id, id)));
  return r;
}
