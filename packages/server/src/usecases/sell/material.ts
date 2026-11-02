// Filament and supplies spent by production (docs/04 §1, §8): spool by spool, never negative; purge recorded apart.
import type { Warning } from '@app/contract';
import { filamentShortfall, planDeduction, round1 } from '@app/core';
import { getSettings, insertSpoolMovements, insertSupplyMovements, listAllFilaments, listSpools, lockSpoolsOfFilament, type Ctx, type Executor } from '@app/db';
import { toSpoolInput } from '../../views/filament-view';

const filamentName = (f: { material: string; color: string }) => `${f.material} ${f.color}`;

/** Grams needed per filament (with purge) against what is left: the FILAMENT_SHORTFALL warning, or none. */
export async function shortfall(ex: Executor, ctx: Ctx, grams: Readonly<Record<string, number>>): Promise<Warning | null> {
  const ids = Object.keys(grams).filter((id) => grams[id]! > 0);
  if (!ids.length) return null;
  const purge = (await getSettings(ex, ctx))?.purgePct ?? 0;
  const fils = new Map((await listAllFilaments(ex, ctx)).map((f) => [f.id, f]));
  const spools = await listSpools(ex, ctx, ids);
  const items = ids.map((id) => {
    const left = spools.filter((s) => s.filamentId === id).reduce((a, s) => a + Math.max(0, s.remainingGrams), 0);
    return { filamentId: id, name: fils.get(id) ? filamentName(fils.get(id)!) : '', missingGrams: filamentShortfall(grams[id]!, purge, left) };
  }).filter((x) => x.missingGrams > 0);
  return items.length ? { code: 'FILAMENT_SHORTFALL', details: { items, filamentId: items[0]!.filamentId, name: items[0]!.name, missingGrams: items[0]!.missingGrams } } : null;
}

/** Deducts consumption and purge of each filament from its spools; returns what could not be taken. */
export async function deductFilament(tx: Executor, ctx: Ctx, grams: Readonly<Record<string, number>>, opts: { on: string; note: string; refId: string; nextId: () => string }) {
  const purge = (await getSettings(tx, ctx))?.purgePct ?? 0;
  const missing: Record<string, number> = {};
  for (const [filamentId, g] of Object.entries(grams)) {
    if (!(g > 0)) continue;
    await lockSpoolsOfFilament(tx, ctx, filamentId);
    const plan = planDeduction((await listSpools(tx, ctx, [filamentId])).map(toSpoolInput), g, purge);
    await insertSpoolMovements(tx, ctx, plan.movements.map((m) => ({
      id: opts.nextId(), spoolId: m.spoolId, on: opts.on, kind: m.kind, grams: round1(m.grams), note: m.kind === 'waste' ? `Purga: ${opts.note}` : opts.note, refId: opts.refId,
    })));
    if (plan.missing > 0) missing[filamentId] = plan.missing;
  }
  return missing;
}

export async function useSupplies(tx: Executor, ctx: Ctx, uses: readonly { supplyId: string; qty: number }[], opts: { on: string; note: string; refId: string; nextId: () => string }) {
  await insertSupplyMovements(tx, ctx, uses.filter((u) => u.qty !== 0).map((u) => ({ id: opts.nextId(), supplyId: u.supplyId, on: opts.on, kind: 'use', qty: u.qty, note: opts.note, refId: opts.refId })));
}
