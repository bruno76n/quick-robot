import type { Catalog, SettingsBundle } from '@app/contract';
import { DEFAULT_FILAMENT_HEX, DEFAULT_SETTINGS, fromCents, toCents } from '@app/core';
import { getWorkspace, settingsRepo, type BusinessInfo, type Ctx, type Executor } from '@app/db';

/** Business data of a business that never saved Ajustes: its name, the rest empty. */
export async function defaultBusiness(ex: Executor, ctx: Ctx): Promise<BusinessInfo> {
  const ws = await getWorkspace(ex, ctx);
  return { name: ws?.name ?? '', trade: '', phone: '', email: '', city: '', quoteValidDays: 7, footer: '' };
}

export interface CostSettingsPesos {
  kwhPrice: number;
  purgePct: number;
  failurePct: number;
  minMarginPct: number;
  formulaMarginPct: number;
}

/** Cost settings in pesos for core (defaults if the business never saved them). */
export async function costSettings(ex: Executor, ctx: Ctx): Promise<CostSettingsPesos> {
  const s = await settingsRepo.get(ex, ctx);
  if (!s) return { ...DEFAULT_SETTINGS };
  return { kwhPrice: fromCents(s.kwhPriceCents), purgePct: s.purgePct, failurePct: s.failurePct, minMarginPct: s.minMarginPct, formulaMarginPct: s.formulaMarginPct };
}

export async function getSettingsBundle(ex: Executor, ctx: Ctx): Promise<SettingsBundle> {
  const [s, channels] = await Promise.all([settingsRepo.get(ex, ctx), settingsRepo.listChannels(ex, ctx)]);
  const d = DEFAULT_SETTINGS;
  return {
    settings: s
      ? { kwhPriceCents: s.kwhPriceCents, failurePct: s.failurePct, purgePct: s.purgePct, minMarginPct: s.minMarginPct, formulaMarginPct: s.formulaMarginPct, business: s.business }
      : { kwhPriceCents: toCents(d.kwhPrice), failurePct: d.failurePct, purgePct: d.purgePct, minMarginPct: d.minMarginPct, formulaMarginPct: d.formulaMarginPct, business: await defaultBusiness(ex, ctx) },
    channels: channels.map((c) => ({ id: c.id, name: c.name, commissionPct: c.commissionPct, position: c.position })),
  };
}

export async function getCatalog(ex: Executor, ctx: Ctx): Promise<Catalog> {
  const items = await settingsRepo.listCatalog(ex, ctx);
  return {
    materials: items.filter((i) => i.kind === 'material').map((i) => i.name),
    colors: items.filter((i) => i.kind === 'color').map((i) => ({ name: i.name, hex: i.hex ?? DEFAULT_FILAMENT_HEX })),
    brands: items.filter((i) => i.kind === 'brand').map((i) => i.name),
  };
}
