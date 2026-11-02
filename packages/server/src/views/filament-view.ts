// Build the API shapes of docs/12 §8 from repository rows, with the rules of core.
import type { FilamentDetail, FilamentListItem, Spool, SpoolMovement } from '@app/contract';
import { EMPTY_GRAMS, filamentCostPerGram, filamentRemaining, filamentStatus, round1, toCents, spoolCostPerGram, spoolStatus, spoolUseOrder, type SpoolInput } from '@app/core';
import type { Executor, FilamentRow, SpoolMovementRow, SpoolRow } from '@app/db';
import { listSpools, type Ctx } from '@app/db';

const COST_DECIMALS = 10_000;

export function toSpoolInput(s: SpoolRow): SpoolInput {
  return { id: s.id, purchasedOn: s.purchasedOn, grams: s.grams, costPesos: s.costCents / 100, shippingPesos: s.shippingCents / 100, remaining: s.remainingGrams };
}

export function spoolView(s: SpoolRow): Spool {
  return {
    id: s.id, filamentId: s.filamentId, brand: s.brand, costCents: s.costCents, shippingCents: s.shippingCents, grams: s.grams,
    purchasedOn: s.purchasedOn, supplierId: s.supplierId ?? null, remainingGrams: round1(Math.max(0, s.remainingGrams)),
    costPerGram: Math.round(spoolCostPerGram(toSpoolInput(s)) * COST_DECIMALS) / COST_DECIMALS,
    status: spoolStatus({ remaining: s.remainingGrams, grams: s.grams }),
  };
}

export function filamentListView(f: FilamentRow, spools: readonly SpoolRow[]): FilamentListItem {
  const inputs = spools.map(toSpoolInput);
  const active = spools.filter((s) => s.remainingGrams > EMPTY_GRAMS);
  const value = inputs.reduce((a, s) => a + Math.max(0, s.remaining) * spoolCostPerGram(s), 0);
  return {
    id: f.id, material: f.material, color: f.color, hex: f.hex,
    remainingGrams: filamentRemaining(inputs), spools: spools.length,
    costPerGram: Math.round(filamentCostPerGram(inputs) * COST_DECIMALS) / COST_DECIMALS,
    status: filamentStatus(inputs),
    activeSpools: active.length,
    brands: [...new Set(active.map((s) => s.brand).filter(Boolean))],
    capacityGrams: active.reduce((a, s) => a + s.grams, 0),
    valueCents: toCents(value),
  };
}

export function movementView(m: SpoolMovementRow): SpoolMovement {
  return { id: m.id, spoolId: m.spoolId, on: m.on, kind: m.kind as SpoolMovement['kind'], grams: m.grams, note: m.note, refId: m.refId ?? null };
}

/** Spools in the order they are used, then the empty ones (newest first), like the mockup drawer. */
export function filamentDetailView(f: FilamentRow, spools: readonly SpoolRow[], movements: readonly SpoolMovementRow[]): FilamentDetail {
  const order = spoolUseOrder(spools.map(toSpoolInput)).map((s) => s.id);
  const rest = spools.filter((s) => !order.includes(s.id)).sort((a, b) => b.purchasedOn.localeCompare(a.purchasedOn));
  const sorted = [...order.map((id) => spools.find((s) => s.id === id)!), ...rest];
  return { ...filamentListView(f, spools), spools: sorted.map(spoolView), spoolCount: spools.length, movements: movements.map(movementView) };
}

export async function filamentListItems(ex: Executor, ctx: Ctx, rows: readonly FilamentRow[]) {
  const spools = await listSpools(ex, ctx, rows.map((r) => r.id));
  return rows.map((f) => filamentListView(f, spools.filter((s) => s.filamentId === f.id)));
}
