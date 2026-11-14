// Build the API shapes of docs/12 §8 from repository rows, with the rules of core.
import type { FilamentDetail, FilamentListItem, Spool, SpoolMovement } from '@app/contract';
import {
  EMPTY_GRAMS, filamentCosts, filamentRemaining, filamentStatus, inventoryValue, round1, toCents, spoolCostPerGram, spoolStatus,
  spoolUseOrder, type FilamentCost, type SpoolInput,
} from '@app/core';
import type { Executor, FilamentRow, SpoolMovementRow, SpoolRow } from '@app/db';
import { getSettings, listAllFilaments, listSpools, type Ctx } from '@app/db';

const COST_DECIMALS = 1e10;
const NO_COST: FilamentCost = { costPerGram: 0, source: 'none', spoolIds: [], spoolNumbers: [] };

export function toSpoolInput(s: SpoolRow): SpoolInput {
  return {
    id: s.id, number: s.number, purchasedOn: s.purchasedOn, grams: s.grams, costPesos: s.costCents / 100, shippingPesos: s.shippingCents / 100,
    remaining: s.remainingGrams, noCost: s.noCost,
  };
}

/** Cost per gram of every filament of the workspace (docs/04 §1): its last N purchases with cost, its material, its reference price. */
export function filamentCostMap(filaments: readonly FilamentRow[], spools: readonly SpoolRow[], n: number | undefined): Map<string, FilamentCost> {
  return filamentCosts(
    filaments.map((f) => ({ id: f.id, material: f.material, referenceCentsPerKg: f.referenceCentsPerKg })),
    spools.map((s) => ({ ...toSpoolInput(s), filamentId: s.filamentId })), n,
  );
}

/** Purchases in the average, from Ajustes (`cost_avg_purchases`). */
export async function costAvgPurchases(ex: Executor, ctx: Ctx): Promise<number | undefined> {
  return (await getSettings(ex, ctx))?.costAvgPurchases;
}

/** Every filament of the workspace with its live spools and its cost: four queries, whatever the number of filaments. */
export async function loadFilamentData(ex: Executor, ctx: Ctx) {
  const filaments = await listAllFilaments(ex, ctx);
  const spools = await listSpools(ex, ctx, filaments.map((f) => f.id));
  const costs = filamentCostMap(filaments, spools, await costAvgPurchases(ex, ctx));
  const byFilament = new Map<string, SpoolRow[]>();
  for (const s of spools) byFilament.set(s.filamentId, [...(byFilament.get(s.filamentId) ?? []), s]);
  return { filaments, spools, costs, spoolsOf: (filamentId: string) => byFilament.get(filamentId) ?? [] };
}

export async function loadFilamentCosts(ex: Executor, ctx: Ctx): Promise<Map<string, FilamentCost>> {
  return (await loadFilamentData(ex, ctx)).costs;
}

export function spoolView(s: SpoolRow): Spool {
  return {
    id: s.id, number: s.number, filamentId: s.filamentId, brand: s.brand, costCents: s.costCents, shippingCents: s.shippingCents, grams: s.grams,
    purchasedOn: s.purchasedOn, supplierId: s.supplierId ?? null, noCost: s.noCost, remainingGrams: round1(Math.max(0, s.remainingGrams)),
    costPerGram: Math.round(spoolCostPerGram(toSpoolInput(s)) * COST_DECIMALS) / COST_DECIMALS,
    status: spoolStatus({ remaining: s.remainingGrams, grams: s.grams }),
  };
}

/** Spools in the order they are used, then the empty ones (newest first), like the mockup drawer. */
export function sortedSpools(spools: readonly SpoolRow[]): SpoolRow[] {
  const order = spoolUseOrder(spools.map(toSpoolInput)).map((s) => s.id);
  const inOrder = new Set(order);
  const byId = new Map(spools.map((s) => [s.id, s]));
  const rest = spools.filter((s) => !inOrder.has(s.id)).sort((a, b) => b.purchasedOn.localeCompare(a.purchasedOn) || b.number - a.number);
  return [...order.map((id) => byId.get(id)!), ...rest];
}

export function filamentListView(f: FilamentRow, spools: readonly SpoolRow[], costs: ReadonlyMap<string, FilamentCost>): FilamentListItem {
  const inputs = spools.map(toSpoolInput);
  const active = spools.filter((s) => s.remainingGrams > EMPTY_GRAMS);
  const cost = costs.get(f.id) ?? NO_COST;
  return {
    id: f.id, material: f.material, color: f.color, hex: f.hex,
    remainingGrams: filamentRemaining(inputs),
    spools: sortedSpools(spools).map(spoolView), spoolCount: spools.length,
    costPerGram: Math.round(cost.costPerGram * COST_DECIMALS) / COST_DECIMALS,
    costSource: cost.source, costSpoolNumbers: cost.spoolNumbers, referenceCentsPerKg: f.referenceCentsPerKg ?? null,
    status: filamentStatus(inputs),
    activeSpools: active.length,
    noCostSpools: active.filter((s) => s.noCost).length,
    brands: [...new Set(active.map((s) => s.brand).filter(Boolean))],
    capacityGrams: active.reduce((a, s) => a + s.grams, 0),
    valueCents: toCents(inventoryValue(inputs)),
  };
}

export function movementView(m: SpoolMovementRow): SpoolMovement {
  return { id: m.id, spoolId: m.spoolId, on: m.on, kind: m.kind as SpoolMovement['kind'], grams: m.grams, note: m.note, refId: m.refId ?? null };
}

export function filamentDetailView(f: FilamentRow, spools: readonly SpoolRow[], movements: readonly SpoolMovementRow[], costs: ReadonlyMap<string, FilamentCost>): FilamentDetail {
  return { ...filamentListView(f, spools, costs), movements: movements.map(movementView) };
}

/** A page of filaments: their spools and costs come from one load of the workspace (no query per filament). */
export async function filamentListItems(ex: Executor, ctx: Ctx, rows: readonly FilamentRow[]) {
  const data = await loadFilamentData(ex, ctx);
  return rows.map((f) => filamentListView(f, data.spoolsOf(f.id), data.costs));
}

/** One filament with its spools, after a write (the cost may depend on the other filaments of its material). */
export async function filamentOut(ex: Executor, ctx: Ctx, filamentId: string) {
  const data = await loadFilamentData(ex, ctx);
  const f = data.filaments.find((x) => x.id === filamentId)!;
  const spools = data.spoolsOf(filamentId);
  return { filament: filamentListView(f, spools, data.costs), cost: data.costs.get(filamentId) ?? NO_COST, spools, spool: (id: string) => spoolView(spools.find((s) => s.id === id)!) };
}
