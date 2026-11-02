// addSpool — register a spool purchase; creates the filament if it does not exist (docs/04 §1, docs/06 §6, docs/12 §8).
import type { AddSpoolInput, AddSpoolOutput } from '@app/contract';
import { canonicalEntry, defaultCatalog, filamentKey, tidyName } from '@app/core';
import {
  findFilamentByKey, getFilament, insertFilament, insertSpool, insertSpoolMovements, listSpools, transaction, type Ctx,
} from '@app/db';
import type { Deps } from '../deps';
import { notFound } from '../http';
import { filamentListView, spoolView } from '../views/filament-view';


export async function addSpool(deps: Deps, ctx: Ctx, input: AddSpoolInput): Promise<AddSpoolOutput> {
  return transaction(deps.db, async (tx) => {
    let filament = input.filamentId ? await getFilament(tx, ctx, input.filamentId) : undefined;
    if (input.filamentId && !filament) throw notFound('filament');
    if (!filament && input.filament) {
      const catalog = defaultCatalog();
      const material = canonicalEntry('material', catalog.material, input.filament.material).name;
      const color = canonicalEntry('color', catalog.color, input.filament.color, input.filament.hex);
      const key = filamentKey(material, color.name);
      filament = (await findFilamentByKey(tx, ctx, key))
        ?? (await insertFilament(tx, ctx, { id: deps.ids.next(), material, color: color.name, hex: color.hex!, nameKey: key }));
    }
    const spool = await insertSpool(tx, ctx, {
      id: deps.ids.next(), filamentId: filament!.id, brand: tidyName(input.brand), costCents: input.costCents,
      shippingCents: input.shippingCents, grams: input.grams, purchasedOn: input.purchasedOn, supplierId: input.supplierId ?? null,
    });
    await insertSpoolMovements(tx, ctx, [{ id: deps.ids.next(), spoolId: spool.id, on: input.purchasedOn, kind: 'purchase', grams: input.grams, note: input.note ?? '' }]);
    const spools = await listSpools(tx, ctx, [filament!.id]);
    return { spool: spoolView(spools.find((s) => s.id === spool.id)!), filament: filamentListView(filament!, spools) };
  });
}
