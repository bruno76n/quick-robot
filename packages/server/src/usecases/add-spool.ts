// addSpool (docs/06 §6): creates the filament (material + color) if it does not exist, the spool and its
// `purchase` movement — all in one transaction. What was typed joins the pick lists (catalog).
import { AddSpoolInput, type AddSpoolResult } from '@app/contract';
import { DEFAULT_FILAMENT_HEX, filamentKey } from '@app/core';
import { filamentRepo, type Ctx, type Database, type Executor, type FilamentRow } from '@app/db';
import type { Entitlements } from '../deps';
import { getFilamentDetail } from '../queries/filaments';
import { addToCatalog } from './settings';

export interface AddSpoolDeps {
  database: Database;
  entitlements: Entitlements;
}

/** The filament for material + color; created (or restored) if needed. */
export async function resolveFilament(tx: Executor, ctx: Ctx, material: string, color: string, hex: string | undefined): Promise<{ filament: FilamentRow; created: boolean }> {
  const nameKey = filamentKey(material, color);
  const found = await filamentRepo.findByKey(tx, ctx, nameKey);
  if (found) {
    if (found.deletedAt) await filamentRepo.restore(tx, ctx, found.id);
    return { filament: found, created: false };
  }
  const filament = await filamentRepo.create(tx, ctx, { material, color, hex: hex ?? DEFAULT_FILAMENT_HEX, nameKey });
  return { filament, created: true };
}

export async function addSpool(deps: AddSpoolDeps, ctx: Ctx, raw: unknown): Promise<AddSpoolResult> {
  const input = AddSpoolInput.parse(raw);
  await deps.entitlements.assert(ctx, 'spools.create');
  return deps.database.transaction(async (tx) => {
    const { filament, created } = await resolveFilament(tx, ctx, input.material, input.color, input.hex);
    await addToCatalog(tx, ctx, { material: input.material, color: input.color, hex: input.hex ?? filament.hex, brand: input.brand });
    const spool = await filamentRepo.insertSpool(tx, ctx, {
      filamentId: filament.id,
      brand: input.brand,
      costCents: input.costCents,
      shippingCents: input.shippingCents,
      grams: input.grams,
      purchasedOn: input.purchasedOn,
      supplierId: input.supplierId ?? null,
    });
    await filamentRepo.insertMovement(tx, ctx, { spoolId: spool.id, on: input.purchasedOn, kind: 'purchase', grams: input.grams, note: '' });
    return { createdFilament: created, spoolId: spool.id, filament: await getFilamentDetail(tx, ctx, filament.id) };
  });
}
