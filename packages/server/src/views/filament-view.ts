// Build the API shapes of docs/12 §8 from repository rows, with the rules of core.
import type { FilamentDetail, FilamentListItem, Spool, SpoolMovement } from '@app/contract';
import {
  COST_AVG_PURCHASES, EMPTY_GRAMS, filamentCosts, filamentRemaining, filamentStatus, inventoryValue, round1, toCents, spoolCostPerGram, spoolStatus,
  spoolUseOrder, type FilamentCost, type SpoolInput,
} from '@app/core';
import type { Executor, FilamentRow, SpoolMovementRow, SpoolRow } from '@app/db';
import { listAllFilaments, listSpools, type Ctx } from '@app/db';

const COST_DECIMALS = 1e10;

export function toSpoolInput(s: SpoolRow): SpoolInput {
  return { id: s.id, purchasedOn: s.purchasedOn, grams: s.grams, costPesos: s.costCents / 100, shippingPesos: s.shippingCents / 100, remaining: s.remainingGrams };
}

/**
 * Cost per gram of every filament of the workspace (docs/04 §1): its last purchases with cost, else its material.
 * Until the data of ronda 4 exists (phase B), N is the default and a spool that cost $0 counts as a no-cost spool.
 */
export function filamentCostMap(filaments: readonly FilamentRow[], spools: readonly SpoolRow[]): Map<string, FilamentCost> {
  return filamentCosts(
    filaments.map((f) => ({ id: f.id, material: f.material })),
    spools.map((s) => ({ ...toSpoolInput(s), filamentId: s.filamentId })), COST_AVG_PURCHASES.default,
  );
}

export async function loadFilamentCosts(ex: Executor, ctx: Ctx): Promise<Map<string, FilamentCost>> {
  const filaments = await listAllFilaments(ex, ctx);
  return filamentCostMap(filaments, await listSpools(ex, ctx, filaments.map((f) => f.id)));
}

export function spoolView(s: SpoolRow): Spool {
  return {
    id: s.id, filamentId: s.filamentId, brand: s.brand, costCents: s.costCents, shippingCents: s.shippingCents, grams: s.grams,
    purchasedOn: s.purchasedOn, supplierId: s.supplierId ?? null, remainingGrams: round1(Math.max(0, s.remainingGrams)),
    costPerGram: Math.round(spoolCostPerGram(toSpoolInput(s)) * COST_DECIMALS) / COST_DECIMALS,
    status: spoolStatus({ remaining: s.remainingGrams, grams: s.grams }),
  };
}

export function filamentListView(f: FilamentRow, spools: readonly SpoolRow[], costs: ReadonlyMap<string, FilamentCost>): FilamentListItem {
  const inputs = spools.map(toSpoolInput);
  const active = spools.filter((s) => s.remainingGrams > EMPTY_GRAMS);
  return {
    id: f.id, material: f.material, color: f.color, hex: f.hex,
    remainingGrams: filamentRemaining(inputs), spools: spools.length,
    costPerGram: Math.round((costs.get(f.id)?.costPerGram ?? 0) * COST_DECIMALS) / COST_DECIMALS,
    status: filamentStatus(inputs),
    activeSpools: active.length,
    brands: [...new Set(active.map((s) => s.brand).filter(Boolean))],
    capacityGrams: active.reduce((a, s) => a + s.grams, 0),
    valueCents: toCents(inventoryValue(inputs)),
  };
}

export function movementView(m: SpoolMovementRow): SpoolMovement {
  return { id: m.id, spoolId: m.spoolId, on: m.on, kind: m.kind as SpoolMovement['kind'], grams: m.grams, note: m.note, refId: m.refId ?? null };
}

/** Spools in the order they are used, then the empty ones (newest first), like the mockup drawer. */
export function filamentDetailView(f: FilamentRow, spools: readonly SpoolRow[], movements: readonly SpoolMovementRow[], costs: ReadonlyMap<string, FilamentCost>): FilamentDetail {
  const order = spoolUseOrder(spools.map(toSpoolInput)).map((s) => s.id);
  const rest = spools.filter((s) => !order.includes(s.id)).sort((a, b) => b.purchasedOn.localeCompare(a.purchasedOn));
  const sorted = [...order.map((id) => spools.find((s) => s.id === id)!), ...rest];
  return { ...filamentListView(f, spools, costs), spools: sorted.map(spoolView), spoolCount: spools.length, movements: movements.map(movementView) };
}

export async function filamentListItems(ex: Executor, ctx: Ctx, rows: readonly FilamentRow[]) {
  const spools = await listSpools(ex, ctx, rows.map((r) => r.id));
  const costs = await loadFilamentCosts(ex, ctx);
  return rows.map((f) => filamentListView(f, spools.filter((s) => s.filamentId === f.id), costs));
}
