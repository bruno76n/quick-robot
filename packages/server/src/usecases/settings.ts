// Ajustes: updateSettings, addChannel, updateChannel, removeChannel (docs/06 §15), and the generic defaults
// of a business (settings + catalog), applied once.
import { BusinessError, ChannelInput, UpdateChannelInput, UpdateSettingsInput, type Channel, type SettingsBundle } from '@app/contract';
import { DEFAULT_BRANDS, DEFAULT_COLORS, DEFAULT_MATERIALS, DEFAULT_SETTINGS, normalizeName, toCents } from '@app/core';
import { settingsRepo, type Ctx, type Executor } from '@app/db';
import type { UseCaseDeps } from './deps';
import { defaultBusiness, getSettingsBundle } from '../queries/settings';

/** Creates the settings row and the starting catalog if the business has none yet (idempotent). */
export async function ensureWorkspaceDefaults(ex: Executor, ctx: Ctx): Promise<void> {
  if (!(await settingsRepo.get(ex, ctx))) {
    const d = DEFAULT_SETTINGS;
    await settingsRepo.upsert(ex, ctx, {
      kwhPriceCents: toCents(d.kwhPrice),
      failurePct: d.failurePct,
      purgePct: d.purgePct,
      minMarginPct: d.minMarginPct,
      formulaMarginPct: d.formulaMarginPct,
      business: await defaultBusiness(ex, ctx),
    });
  }
  if ((await settingsRepo.listCatalog(ex, ctx)).length === 0) {
    for (const name of DEFAULT_MATERIALS) await settingsRepo.addCatalogItem(ex, ctx, { kind: 'material', name, nameKey: normalizeName(name) });
    for (const c of DEFAULT_COLORS) await settingsRepo.addCatalogItem(ex, ctx, { kind: 'color', name: c.name, nameKey: normalizeName(c.name), hex: c.hex });
    for (const name of DEFAULT_BRANDS) await settingsRepo.addCatalogItem(ex, ctx, { kind: 'brand', name, nameKey: normalizeName(name) });
  }
}

export async function updateSettings(deps: UseCaseDeps, ctx: Ctx, raw: unknown): Promise<SettingsBundle> {
  const input = UpdateSettingsInput.parse(raw);
  return deps.database.transaction(async (tx) => {
    await ensureWorkspaceDefaults(tx, ctx);
    const cur = (await settingsRepo.get(tx, ctx))!;
    await settingsRepo.upsert(tx, ctx, {
      kwhPriceCents: input.kwhPriceCents ?? cur.kwhPriceCents,
      failurePct: input.failurePct ?? cur.failurePct,
      purgePct: input.purgePct ?? cur.purgePct,
      minMarginPct: input.minMarginPct ?? cur.minMarginPct,
      formulaMarginPct: input.formulaMarginPct ?? cur.formulaMarginPct,
      business: { ...cur.business, ...input.business },
    });
    return getSettingsBundle(tx, ctx);
  });
}

async function assertUniqueChannel(ex: Executor, ctx: Ctx, nameKey: string, exceptId?: string) {
  const all = await settingsRepo.listChannels(ex, ctx);
  if (all.some((c) => c.nameKey === nameKey && c.id !== exceptId)) throw new BusinessError('DUPLICATE_NAME', 'Channel name already exists');
}

export async function addChannel(deps: UseCaseDeps, ctx: Ctx, raw: unknown): Promise<Channel> {
  const input = ChannelInput.parse(raw);
  return deps.database.transaction(async (tx) => {
    const nameKey = normalizeName(input.name);
    await assertUniqueChannel(tx, ctx, nameKey);
    const all = await settingsRepo.listChannels(tx, ctx);
    const row = await settingsRepo.insertChannel(tx, ctx, { name: input.name, nameKey, commissionPct: input.commissionPct, position: all.length ? Math.max(...all.map((c) => c.position)) + 1 : 0 });
    return { id: row.id, name: row.name, commissionPct: row.commissionPct, position: row.position };
  });
}

/** Rename or change commission. Sales and orders (phase 3) will be renamed in the same transaction. */
export async function updateChannel(deps: UseCaseDeps, ctx: Ctx, id: string, raw: unknown): Promise<Channel> {
  const input = UpdateChannelInput.parse(raw);
  return deps.database.transaction(async (tx) => {
    const ch = await settingsRepo.getChannel(tx, ctx, id);
    if (!ch) throw new BusinessError('CHANNEL_NOT_FOUND');
    const patch: Parameters<typeof settingsRepo.updateChannel>[3] = {};
    if (input.name !== undefined) {
      patch.nameKey = normalizeName(input.name);
      await assertUniqueChannel(tx, ctx, patch.nameKey, id);
      patch.name = input.name;
    }
    if (input.commissionPct !== undefined) patch.commissionPct = input.commissionPct;
    await settingsRepo.updateChannel(tx, ctx, id, patch);
    const row = (await settingsRepo.getChannel(tx, ctx, id))!;
    return { id: row.id, name: row.name, commissionPct: row.commissionPct, position: row.position };
  });
}

/** At least one channel must remain. (Phase 3: a channel used by sales/orders cannot be removed.) */
export async function removeChannel(deps: UseCaseDeps, ctx: Ctx, id: string): Promise<void> {
  await deps.database.transaction(async (tx) => {
    const ch = await settingsRepo.getChannel(tx, ctx, id);
    if (!ch) throw new BusinessError('CHANNEL_NOT_FOUND');
    if ((await settingsRepo.listChannels(tx, ctx)).length <= 1) throw new BusinessError('LAST_CHANNEL');
    await settingsRepo.updateChannel(tx, ctx, id, { deletedAt: new Date() });
  });
}

/** "Deshacer" of removeChannel. */
export async function restoreChannel(deps: UseCaseDeps, ctx: Ctx, id: string): Promise<void> {
  await deps.database.transaction(async (tx) => {
    const ch = await settingsRepo.getChannel(tx, ctx, id, true);
    if (!ch) throw new BusinessError('CHANNEL_NOT_FOUND');
    await assertUniqueChannel(tx, ctx, ch.nameKey, id);
    await settingsRepo.updateChannel(tx, ctx, id, { deletedAt: null });
  });
}

/** Adds what was typed to the pick lists (materials, colors with hex, brands). */
export async function addToCatalog(ex: Executor, ctx: Ctx, o: { material?: string; color?: string; hex?: string | null; brand?: string }): Promise<void> {
  if (o.material) await settingsRepo.addCatalogItem(ex, ctx, { kind: 'material', name: o.material, nameKey: normalizeName(o.material) });
  if (o.color) await settingsRepo.addCatalogItem(ex, ctx, { kind: 'color', name: o.color, nameKey: normalizeName(o.color), hex: o.hex ?? null });
  if (o.brand) await settingsRepo.addCatalogItem(ex, ctx, { kind: 'brand', name: o.brand, nameKey: normalizeName(o.brand) });
}
