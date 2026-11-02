// updateSpool, deleteSpool (+ restore) and recordSpoolMovement (docs/06 §6).
// The ledger only grows: editing the grams of a spool records an `adjustment` for the difference.
import { BusinessError, SpoolMovementInput, UpdateSpoolInput, type SpoolResult } from '@app/contract';
import { round1 } from '@app/core';
import { filamentRepo, productRepo, type Ctx, type Executor } from '@app/db';
import { getFilamentDetail } from '../queries/filaments';
import type { UseCaseDeps } from './deps';
import { resolveFilament } from './add-spool';
import { addToCatalog } from './settings';

const USABLE_TOLERANCE = 0.05;

/** A filament with no live spools and no live product using it leaves the list (mockup `limpiaFils`). */
async function hideFilamentIfUnused(tx: Executor, ctx: Ctx, filamentId: string) {
  if ((await filamentRepo.listSpools(tx, ctx, [filamentId])).length) return;
  const lines = await productRepo.lines(tx, ctx);
  const live = new Set((await productRepo.list(tx, ctx)).map((p) => p.id));
  if (lines.filaments.some((l) => l.filamentId === filamentId && live.has(l.productId))) return;
  await filamentRepo.setFilamentDeleted(tx, ctx, filamentId, true);
}

export async function updateSpool(deps: UseCaseDeps, ctx: Ctx, spoolId: string, raw: unknown): Promise<SpoolResult> {
  const input = UpdateSpoolInput.parse(raw);
  return deps.database.transaction(async (tx) => {
    const spool = await filamentRepo.getSpool(tx, ctx, spoolId);
    if (!spool) throw new BusinessError('SPOOL_NOT_FOUND');
    const { filament } = await resolveFilament(tx, ctx, input.material, input.color, input.hex);
    await addToCatalog(tx, ctx, { material: input.material, color: input.color, hex: input.hex ?? filament.hex, brand: input.brand });
    await filamentRepo.updateSpool(tx, ctx, spoolId, {
      filamentId: filament.id,
      brand: input.brand,
      costCents: input.costCents,
      shippingCents: input.shippingCents,
      grams: input.grams,
      purchasedOn: input.purchasedOn,
      supplierId: input.supplierId ?? null,
    });
    const diff = round1(input.grams - spool.grams);
    if (diff !== 0) await filamentRepo.insertMovement(tx, ctx, { spoolId, on: deps.clock.today(), kind: 'adjustment', grams: diff, note: '' });
    if (filament.id !== spool.filamentId) await hideFilamentIfUnused(tx, ctx, spool.filamentId);
    return { spoolId, filament: await getFilamentDetail(tx, ctx, filament.id) };
  });
}

/** Soft delete; "Deshacer" restores the spool (and its filament). Its movements stay in the ledger. */
export async function deleteSpool(deps: UseCaseDeps, ctx: Ctx, spoolId: string, restore = false): Promise<{ filamentId: string }> {
  return deps.database.transaction(async (tx) => {
    const spool = await filamentRepo.getSpool(tx, ctx, spoolId, true);
    if (!spool || (!restore && spool.deletedAt) || (restore && !spool.deletedAt)) throw new BusinessError('SPOOL_NOT_FOUND');
    await filamentRepo.setSpoolDeleted(tx, ctx, spoolId, !restore);
    if (restore) await filamentRepo.setFilamentDeleted(tx, ctx, spool.filamentId, false);
    else await hideFilamentIfUnused(tx, ctx, spool.filamentId);
    return { filamentId: spool.filamentId };
  });
}

/** Consumption, failure, waste (take out) or adjustment (±). A spool never goes below zero. */
export async function recordSpoolMovement(deps: UseCaseDeps, ctx: Ctx, spoolId: string, raw: unknown): Promise<SpoolResult> {
  const input = SpoolMovementInput.parse(raw);
  return deps.database.transaction(async (tx) => {
    const spool = await filamentRepo.getSpool(tx, ctx, spoolId);
    if (!spool) throw new BusinessError('SPOOL_NOT_FOUND');
    const grams = input.kind === 'adjustment' ? input.grams : -Math.abs(input.grams);
    const remaining = Math.max(0, (await filamentRepo.remainingBySpool(tx, ctx)).get(spoolId) ?? 0);
    if (grams < 0 && -grams > remaining + USABLE_TOLERANCE) throw new BusinessError('INSUFFICIENT_FILAMENT', 'Spool has less', { available: remaining });
    await filamentRepo.insertMovement(tx, ctx, { spoolId, on: input.on, kind: input.kind, grams, note: input.note });
    return { spoolId, filament: await getFilamentDetail(tx, ctx, spool.filamentId) };
  });
}
