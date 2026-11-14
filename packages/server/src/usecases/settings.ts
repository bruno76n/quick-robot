// updateSettings, addChannel, updateChannel, removeChannel and the starting values of a workspace (docs/06 §15, docs/12 §4).
import { BusinessError, type AddChannelInput, type Catalogs, type ChannelView, type SettingsOutput, type SettingsView, type UpdateChannelInput, type UpdateSettingsInput } from '@app/contract';
import { DEFAULT_CHANNELS, DEFAULT_CUSTOMER_TYPES, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_SETTINGS, defaultCatalog, normalizeName, toCents } from '@app/core';
import {
  addCatalogItems, deleteChannel, getChannel, getSettings, getWorkspace, insertChannel, insertSettings, listCatalog, listChannels,
  transaction, updateChannel as updateChannelRow, updateSettings as updateSettingsRow, type ChannelRow, type Ctx, type Executor, type SettingsRow,
} from '@app/db';
import type { Deps } from '../deps';
import { notFound } from '../http';

export const channelView = (c: ChannelRow): ChannelView => ({ id: c.id, name: c.name, commissionPct: c.commissionPct, position: c.position });

function settingsView(s: SettingsRow): SettingsView {
  return {
    kwhPriceCents: s.kwhPriceCents, failurePct: s.failurePct, purgePct: s.purgePct, minMarginPct: s.minMarginPct, formulaMarginPct: s.formulaMarginPct,
    business: s.business, lastBackupOn: s.lastBackupOn ?? null,
  };
}

/** Creates the settings, a channel and the pick lists of a workspace if they do not exist. Idempotent. */
export async function ensureWorkspaceDefaults(deps: Deps, ctx: Ctx, ex: Executor = deps.db) {
  if (await getSettings(ex, ctx)) return false;
  const ws = await getWorkspace(ex, ctx);
  await insertSettings(ex, ctx, {
    kwhPriceCents: toCents(DEFAULT_SETTINGS.kwhPrice), failurePct: DEFAULT_SETTINGS.failurePct, purgePct: DEFAULT_SETTINGS.purgePct,
    minMarginPct: DEFAULT_SETTINGS.minMarginPct, formulaMarginPct: DEFAULT_SETTINGS.formulaMarginPct,
    business: { name: ws?.name ?? '', trade: '', phone: '', email: '', city: '', quoteValidDays: DEFAULT_SETTINGS.quoteValidDays, footer: '' },
  });
  if (!(await listChannels(ex, ctx)).length) {
    for (const [i, ch] of DEFAULT_CHANNELS.entries()) await insertChannel(ex, ctx, { id: deps.ids.next(), name: ch.name, nameKey: normalizeName(ch.name), commissionPct: ch.commissionPct, position: i });
  }
  const c = defaultCatalog();
  await addCatalogItems(ex, ctx, [
    ...c.material.map((x) => ({ kind: 'material', name: x.name })), ...c.color.map((x) => ({ kind: 'color', name: x.name, hex: x.hex ?? null })),
    ...c.brand.map((x) => ({ kind: 'brand', name: x.name })), ...DEFAULT_CUSTOMER_TYPES.map((name) => ({ kind: 'customer_type', name })),
    ...DEFAULT_EXPENSE_CATEGORIES.map((name) => ({ kind: 'expense_category', name })),
  ].map((x) => ({ id: deps.ids.next(), nameKey: normalizeName(x.name), hex: null, ...x })));
  return true;
}

export async function loadCatalogs(ex: Executor, ctx: Ctx): Promise<Catalogs> {
  const rows = await listCatalog(ex, ctx);
  const of = (kind: string) => rows.filter((r) => r.kind === kind).map((r) => ({ name: r.name, hex: r.hex ?? null }));
  const brands = rows.filter((r) => r.kind === 'brand').map((r) => ({ name: r.name, hex: null, tareGrams: r.spoolTareGrams ?? null }));
  return { materials: of('material'), colors: of('color'), brands, customerTypes: of('customer_type'), expenseCategories: of('expense_category') };
}

export async function getSettingsOutput(deps: Deps, ctx: Ctx): Promise<SettingsOutput> {
  const s = await getSettings(deps.db, ctx);
  if (!s) throw notFound('settings');
  return { settings: settingsView(s), channels: (await listChannels(deps.db, ctx)).map(channelView), catalogs: await loadCatalogs(deps.db, ctx) };
}

export async function updateSettings(deps: Deps, ctx: Ctx, input: UpdateSettingsInput): Promise<SettingsView> {
  return transaction(deps.db, async (tx) => {
    const s = await getSettings(tx, ctx);
    if (!s) throw notFound('settings');
    const { business, ...rest } = input;
    const patch = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
    const row = await updateSettingsRow(tx, ctx, { ...patch, ...(business ? { business: { ...s.business, ...Object.fromEntries(Object.entries(business).filter(([, v]) => v !== undefined)) } } : {}) });
    return settingsView(row!);
  });
}

async function assertChannelName(tx: Executor, ctx: Ctx, name: string, exceptId?: string) {
  const key = normalizeName(name);
  const clash = (await listChannels(tx, ctx)).find((c) => c.nameKey === key && c.id !== exceptId);
  if (clash) throw new BusinessError('CHANNEL_NAME_EXISTS', { name: clash.name });
  return key;
}

export async function addChannel(deps: Deps, ctx: Ctx, input: AddChannelInput): Promise<ChannelView> {
  return transaction(deps.db, async (tx) => {
    const name = input.name.trim().replace(/\s+/g, ' ');
    const nameKey = await assertChannelName(tx, ctx, name);
    const all = await listChannels(tx, ctx);
    return channelView(await insertChannel(tx, ctx, { id: deps.ids.next(), name, nameKey, commissionPct: input.commissionPct, position: all.length }));
  });
}

/** Renaming changes one row: sales and orders point to channel_id (D27). */
export async function updateChannel(deps: Deps, ctx: Ctx, id: string, input: UpdateChannelInput): Promise<ChannelView> {
  return transaction(deps.db, async (tx) => {
    if (!(await getChannel(tx, ctx, id))) throw notFound('channel');
    const patch: Parameters<typeof updateChannelRow>[3] = {};
    if (input.name !== undefined) { patch.name = input.name.trim().replace(/\s+/g, ' '); patch.nameKey = await assertChannelName(tx, ctx, patch.name, id); }
    if (input.commissionPct !== undefined) patch.commissionPct = input.commissionPct;
    if (input.position !== undefined) patch.position = input.position;
    return channelView((await updateChannelRow(tx, ctx, id, patch))!);
  });
}

/** Usage of a channel by sales and orders (filled in phase 3 when those tables exist). */
export type ChannelUsage = (tx: Executor, ctx: Ctx, channelId: string) => Promise<{ sales: number; orders: number }>;
let channelUsage: ChannelUsage = async () => ({ sales: 0, orders: 0 });
export function setChannelUsage(fn: ChannelUsage) { channelUsage = fn; }

export async function removeChannel(deps: Deps, ctx: Ctx, id: string): Promise<void> {
  await transaction(deps.db, async (tx) => {
    const ch = await getChannel(tx, ctx, id);
    if (!ch) throw notFound('channel');
    if ((await listChannels(tx, ctx)).length <= 1) throw new BusinessError('LAST_CHANNEL');
    const used = await channelUsage(tx, ctx, id);
    if (used.sales || used.orders) throw new BusinessError('CHANNEL_IN_USE', { name: ch.name, ...used });
    await deleteChannel(tx, ctx, id);
  });
}
