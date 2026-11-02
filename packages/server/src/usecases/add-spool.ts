// addSpool — register a spool purchase; creates the filament if it does not exist (docs/04 §1, docs/06 §6, docs/12 §8).
import type { AddSpoolInput, AddSpoolOutput } from '@app/contract';
import { filamentKey } from '@app/core';
import {
  findFilamentByKey, getFilament, insertFilament, insertSpool, insertSpoolMovements, listSpools, transaction, type Ctx,
} from '@app/db';
import type { Deps } from '../deps';
import { notFound } from '../http';
import { filamentListView, spoolView } from '../views/filament-view';

/** Gray used by the mockup when a color has no known tone. */
export const DEFAULT_HEX = '#9a9aa6';

const tidy = (s: string) => s.trim().replace(/\s+/g, ' ');

export async function addSpool(deps: Deps, ctx: Ctx, input: AddSpoolInput): Promise<AddSpoolOutput> {
  return transaction(deps.db, async (tx) => {
    let filament = input.filamentId ? await getFilament(tx, ctx, input.filamentId) : undefined;
    if (input.filamentId && !filament) throw notFound('filament');
    if (!filament && input.filament) {
      const material = tidy(input.filament.material);
      const color = tidy(input.filament.color);
      const key = filamentKey(material, color);
      filament = (await findFilamentByKey(tx, ctx, key))
        ?? (await insertFilament(tx, ctx, { id: deps.ids.next(), material, color, hex: input.filament.hex ?? DEFAULT_HEX, nameKey: key }));
    }
    const spool = await insertSpool(tx, ctx, {
      id: deps.ids.next(), filamentId: filament!.id, brand: tidy(input.brand), costCents: input.costCents,
      shippingCents: input.shippingCents, grams: input.grams, purchasedOn: input.purchasedOn, supplierId: input.supplierId ?? null,
    });
    await insertSpoolMovements(tx, ctx, [{ id: deps.ids.next(), spoolId: spool.id, on: input.purchasedOn, kind: 'purchase', grams: input.grams, note: input.note ?? '' }]);
    const spools = await listSpools(tx, ctx, [filament!.id]);
    return { spool: spoolView(spools.find((s) => s.id === spool.id)!), filament: filamentListView(filament!, spools) };
  });
}
