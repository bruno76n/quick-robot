// addSpool (docs/06 §6): creates the filament (material + color) if it does not exist, the spool and its
// `purchase` movement — all in one transaction.
import { AddSpoolInput, type AddSpoolResult } from '@app/contract';
import { DEFAULT_FILAMENT_HEX, filamentKey } from '@app/core';
import { filamentRepo, type Ctx, type Database } from '@app/db';
import type { Entitlements } from '../deps';
import { getFilamentDetail } from '../queries/filaments';

export interface AddSpoolDeps {
  database: Database;
  entitlements: Entitlements;
}

export async function addSpool(deps: AddSpoolDeps, ctx: Ctx, raw: unknown): Promise<AddSpoolResult> {
  const input = AddSpoolInput.parse(raw);
  await deps.entitlements.assert(ctx, 'spools.create');
  return deps.database.transaction(async (tx) => {
    const nameKey = filamentKey(input.material, input.color);
    let filament = await filamentRepo.findByKey(tx, ctx, nameKey);
    let createdFilament = false;
    if (!filament) {
      filament = await filamentRepo.create(tx, ctx, {
        material: input.material,
        color: input.color,
        hex: input.hex ?? DEFAULT_FILAMENT_HEX,
        nameKey,
      });
      createdFilament = true;
    } else if (filament.deletedAt) {
      await filamentRepo.restore(tx, ctx, filament.id);
    }
    const spool = await filamentRepo.insertSpool(tx, ctx, {
      filamentId: filament.id,
      brand: input.brand,
      costCents: input.costCents,
      shippingCents: input.shippingCents,
      grams: input.grams,
      purchasedOn: input.purchasedOn,
      supplierId: input.supplierId ?? null,
    });
    await filamentRepo.insertMovement(tx, ctx, {
      spoolId: spool.id,
      on: input.purchasedOn,
      kind: 'purchase',
      grams: input.grams,
      note: '',
    });
    return { createdFilament, spoolId: spool.id, filament: await getFilamentDetail(tx, ctx, filament.id) };
  });
}
