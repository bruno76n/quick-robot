// Read-only queries for Filamentos. Every number is computed with core from the ledger.
import {
  activeSpools,
  compareFilaments,
  filamentCostPerGram,
  filamentFillPct,
  filamentRemaining,
  filamentStatus,
  filamentValue,
  fromCents,
  spoolCostPerGram,
  spoolStatus,
  spoolsForDisplay,
  toCents,
  type SpoolWithRemaining,
} from '@app/core';
import type { Filament, FilamentDetail, FilamentList, SpoolMovement } from '@app/contract';
import { BusinessError } from '@app/contract';
import { filamentRepo, type Ctx, type Executor, type FilamentRow, type SpoolRow } from '@app/db';

type CoreSpool = SpoolWithRemaining & { row: SpoolRow };

function toCoreSpools(rows: readonly SpoolRow[], remaining: Map<string, number>): CoreSpool[] {
  return rows.map((row) => ({
    id: row.id,
    cost: fromCents(row.costCents),
    shipping: fromCents(row.shippingCents),
    grams: row.grams,
    purchasedOn: row.purchasedOn,
    remaining: remaining.get(row.id) ?? 0,
    row,
  }));
}

function summarize(f: FilamentRow, spools: readonly CoreSpool[]): Filament {
  const { status, tone } = filamentStatus(spools);
  const active = activeSpools(spools);
  return {
    id: f.id,
    material: f.material,
    color: f.color,
    hex: f.hex,
    spoolCount: spools.length,
    activeSpoolCount: active.length,
    brands: [...new Set(active.map((s) => s.row.brand))],
    remainingGrams: filamentRemaining(spools),
    fillPct: filamentFillPct(spools),
    costPerGram: filamentCostPerGram(spools),
    valueCents: toCents(filamentValue(spools)),
    status,
    tone,
  };
}

function groupByFilament(spools: CoreSpool[]): Map<string, CoreSpool[]> {
  const out = new Map<string, CoreSpool[]>();
  for (const s of spools) {
    const list = out.get(s.row.filamentId) ?? [];
    list.push(s);
    out.set(s.row.filamentId, list);
  }
  return out;
}

export async function listFilaments(ex: Executor, ctx: Ctx): Promise<FilamentList> {
  const [filaments, spoolRows, remaining] = await Promise.all([
    filamentRepo.list(ex, ctx),
    filamentRepo.listSpools(ex, ctx),
    filamentRepo.remainingBySpool(ex, ctx),
  ]);
  const spools = toCoreSpools(spoolRows, remaining);
  const byFilament = groupByFilament(spools);
  const items = [...filaments].sort(compareFilaments).map((f) => summarize(f, byFilament.get(f.id) ?? []));
  const liveSpools = spools.filter((s) => byFilament.has(s.row.filamentId) && filaments.some((f) => f.id === s.row.filamentId));
  return {
    items,
    totals: {
      filaments: items.length,
      spools: liveSpools.length,
      remainingGrams: items.reduce((a, f) => a + f.remainingGrams, 0),
      valueCents: toCents(filamentValue(liveSpools)),
    },
  };
}

export async function getFilamentDetail(ex: Executor, ctx: Ctx, filamentId: string, movementLimit = 14): Promise<FilamentDetail> {
  const f = await filamentRepo.get(ex, ctx, filamentId);
  if (!f) throw new BusinessError('FILAMENT_NOT_FOUND', `Filament ${filamentId} not found`);
  const [spoolRows, remaining] = await Promise.all([filamentRepo.listSpools(ex, ctx, [f.id]), filamentRepo.remainingBySpool(ex, ctx)]);
  const spools = toCoreSpools(spoolRows, remaining);
  const movements = await filamentRepo.listMovements(ex, ctx, spoolRows.map((s) => s.id), movementLimit);
  return {
    ...summarize(f, spools),
    spools: spoolsForDisplay(spools).map((s) => ({
      id: s.id,
      filamentId: s.row.filamentId,
      brand: s.row.brand,
      costCents: s.row.costCents,
      shippingCents: s.row.shippingCents,
      grams: s.grams,
      purchasedOn: s.purchasedOn,
      supplierId: s.row.supplierId,
      remainingGrams: Math.max(0, s.remaining),
      costPerGram: spoolCostPerGram(s),
      status: spoolStatus(s),
      usedFirst: s.usedFirst,
    })),
    movements: movements.map(
      (m): SpoolMovement => ({ id: m.id, spoolId: m.spoolId, on: m.on, kind: m.kind, grams: m.grams, note: m.note, refId: m.refId }),
    ),
  };
}
