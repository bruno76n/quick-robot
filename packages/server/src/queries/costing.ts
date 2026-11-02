import type { CostingContextDto } from '@app/contract';
import { fromCents, type CostingContext } from '@app/core';
import { printerRepo, settingsRepo, supplyRepo, type Ctx, type Executor } from '@app/db';
import { listFilaments } from './filaments';
import { costSettings, defaultBusiness } from './settings';

/** Everything needed to cost catalog items: the same data feeds the server and the calculator preview. */
export async function loadCostingContext(ex: Executor, ctx: Ctx): Promise<{ core: CostingContext; dto: CostingContextDto }> {
  const [settings, channels, printers, filaments, supplies, s] = await Promise.all([
    costSettings(ex, ctx),
    settingsRepo.listChannels(ex, ctx),
    printerRepo.list(ex, ctx),
    listFilaments(ex, ctx),
    supplyRepo.list(ex, ctx),
    settingsRepo.get(ex, ctx),
  ]);
  const dto: CostingContextDto = {
    settings,
    channels: channels.map((c) => ({ id: c.id, name: c.name, commissionPct: c.commissionPct })),
    printers: printers.map((p) => ({ id: p.id, name: p.name, cost: fromCents(p.costCents), lifeHours: p.lifeHours, maintenancePerHour: fromCents(p.maintenanceCentsPerHour), kw: p.kw })),
    filaments: filaments.items.map((f) => ({ id: f.id, material: f.material, color: f.color, hex: f.hex, costPerGram: f.costPerGram, remainingGrams: f.remainingGrams, activeSpoolCount: f.activeSpoolCount })),
    supplies: supplies.map((x) => ({ id: x.id, name: x.name, unit: x.unit, cost: fromCents(x.costCents) })),
    businessName: s?.business.name || (await defaultBusiness(ex, ctx)).name,
  };
  return { core: costingFromDto(dto), dto };
}

export function costingFromDto(dto: CostingContextDto): CostingContext {
  return {
    settings: dto.settings,
    printers: dto.printers,
    filaments: Object.fromEntries(dto.filaments.map((f) => [f.id, { costPerGram: f.costPerGram, material: f.material }])),
    supplies: Object.fromEntries(dto.supplies.map((x) => [x.id, { cost: x.cost }])),
  };
}
