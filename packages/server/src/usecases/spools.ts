// updateSpool, deleteSpool, restoreSpool, recordSpoolMovement (docs/04 §1, docs/06 §6, docs/12 §8).
import { BusinessError, type FilamentListItem, type Spool, type SpoolMovementInput, type UpdateSpoolInput } from '@app/contract';
import { round1, tidyName } from '@app/core';
import {
  countSpoolMovements, getFilament, getSpool, getSpoolAny, getSupplier, insertSpoolMovements, listSpools, setSpoolDeleted, spoolRemainingGrams,
  transaction, updateSpool as updateRow, type Ctx, type Executor,
} from '@app/db';
import type { Deps } from '../deps';
import { notFound } from '../http';
import { filamentListView, spoolView } from '../views/filament-view';
import { resolveFilament } from './add-spool';

async function out(tx: Executor, ctx: Ctx, spoolId: string, filamentId: string): Promise<{ spool: Spool; filament: FilamentListItem }> {
  const f = (await getFilament(tx, ctx, filamentId))!;
  const spools = await listSpools(tx, ctx, [filamentId]);
  return { spool: spoolView(spools.find((s) => s.id === spoolId)!), filament: filamentListView(f, spools) };
}

/**
 * Edit a spool. The ledger is never rewritten: if the grams of the purchase change, an "adjustment" movement
 * records the difference (decision 2.3). Changing material or color moves the spool to that filament.
 */
export async function updateSpool(deps: Deps, ctx: Ctx, id: string, input: UpdateSpoolInput) {
  return transaction(deps.db, async (tx) => {
    const s = await getSpool(tx, ctx, id, { forUpdate: true });
    if (!s) throw notFound('spool');
    let filamentId = s.filamentId;
    if (input.filamentId || input.filament) filamentId = (await resolveFilament(deps, tx, ctx, input)).id;
    if (input.supplierId && !(await getSupplier(tx, ctx, input.supplierId))) throw notFound('supplier');
    await updateRow(tx, ctx, id, {
      filamentId,
      ...(input.brand !== undefined ? { brand: tidyName(input.brand) } : {}),
      ...(input.costCents !== undefined ? { costCents: input.costCents } : {}),
      ...(input.shippingCents !== undefined ? { shippingCents: input.shippingCents } : {}),
      ...(input.grams !== undefined ? { grams: input.grams } : {}),
      ...(input.purchasedOn !== undefined ? { purchasedOn: input.purchasedOn } : {}),
      ...(input.supplierId !== undefined ? { supplierId: input.supplierId } : {}),
    });
    if (input.grams !== undefined && input.grams !== s.grams) {
      await insertSpoolMovements(tx, ctx, [{ id: deps.ids.next(), spoolId: id, on: deps.clock.today(), kind: 'adjustment', grams: round1(input.grams - s.grams), note: '' }]);
    }
    return out(tx, ctx, id, filamentId);
  });
}

/** Soft delete: its movements stay and stop counting. Returns how many it had (for the toast). */
export async function deleteSpool(deps: Deps, ctx: Ctx, id: string) {
  return transaction(deps.db, async (tx) => {
    const s = await getSpool(tx, ctx, id);
    if (!s) throw notFound('spool');
    const movements = await countSpoolMovements(tx, ctx, id);
    await setSpoolDeleted(tx, ctx, id, deps.clock.now());
    return { movements };
  });
}

export async function restoreSpool(deps: Deps, ctx: Ctx, id: string) {
  return transaction(deps.db, async (tx) => {
    const s = await getSpoolAny(tx, ctx, id, { deleted: true });
    if (!s) throw notFound('spool');
    await setSpoolDeleted(tx, ctx, id, null);
    return out(tx, ctx, id, s.filamentId);
  });
}

/** Consumption, failure, waste or adjustment on one spool. A spool never goes negative (SPOOL_INSUFFICIENT). */
export async function recordSpoolMovement(deps: Deps, ctx: Ctx, id: string, input: SpoolMovementInput) {
  return transaction(deps.db, async (tx) => {
    const s = await getSpool(tx, ctx, id, { forUpdate: true });
    if (!s) throw notFound('spool');
    const grams = input.kind === 'adjustment' ? round1(input.grams) : -Math.abs(round1(input.grams));
    const available = Math.max(0, await spoolRemainingGrams(tx, ctx, id));
    if (grams < 0 && -grams > available + 0.05) throw new BusinessError('SPOOL_INSUFFICIENT', { availableGrams: available });
    await insertSpoolMovements(tx, ctx, [{ id: deps.ids.next(), spoolId: id, on: input.on, kind: input.kind, grams, note: input.note?.trim() ?? '' }]);
    return out(tx, ctx, id, s.filamentId);
  });
}
