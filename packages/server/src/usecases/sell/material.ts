// Filament and supplies spent by production (docs/04 §1, §8): spool by spool, never negative; purge recorded apart.
import { BusinessError, type Warning } from '@app/contract';
import { filamentShortfall, planSpoolUse, round1, type SpoolPick } from '@app/core';
import { getSettings, getSpool, insertSpoolMovements, insertSupplyMovements, listAllFilaments, listSpools, lockSpoolsOfFilament, type Ctx, type Executor } from '@app/db';
import { notFound } from '../../http';
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

/** Spools chosen per filament (ronda-4 §2.5). */
export type SpoolPicks = Readonly<Record<string, readonly SpoolPick[]>>;

/**
 * Chosen spools must exist in this workspace (else NOT_FOUND, like any id of another business) and belong to the filament
 * they are chosen for (else SPOOL_NOT_IN_FILAMENT). Checked before anything is written.
 */
export async function assertSpoolPicks(ex: Executor, ctx: Ctx, picks: SpoolPicks) {
  for (const [filamentId, list] of Object.entries(picks)) {
    for (const p of list) {
      const s = await getSpool(ex, ctx, p.spoolId);
      if (!s) throw notFound('spool');
      if (s.filamentId !== filamentId) throw new BusinessError('SPOOL_NOT_IN_FILAMENT', { spoolId: p.spoolId });
    }
  }
}

/**
 * Deducts consumption and purge of each filament from its spools: the chosen ones first, then the use order (docs/04 §1);
 * returns what could not be taken. A chosen part larger than what that spool has → SPOOL_INSUFFICIENT.
 */
export async function deductFilament(
  tx: Executor, ctx: Ctx, grams: Readonly<Record<string, number>>, opts: { on: string; note: string; refId: string; nextId: () => string; picks?: SpoolPicks | undefined },
) {
  const purge = (await getSettings(tx, ctx))?.purgePct ?? 0;
  const missing: Record<string, number> = {};
  for (const [filamentId, g] of Object.entries(grams)) {
    if (!(g > 0)) continue;
    await lockSpoolsOfFilament(tx, ctx, filamentId);
    const plan = planSpoolUse((await listSpools(tx, ctx, [filamentId])).map(toSpoolInput), g, purge, opts.picks?.[filamentId] ?? []);
    if (!plan.ok) {
      throw plan.code === 'SPOOL_INSUFFICIENT'
        ? new BusinessError('SPOOL_INSUFFICIENT', { availableGrams: plan.availableGrams })
        : new BusinessError('SPOOL_NOT_IN_FILAMENT', { spoolId: plan.spoolId });
    }
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
