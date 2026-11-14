// addSpool — register a spool purchase (one or several equal spools with consecutive numbers); creates the filament if it does
// not exist (docs/04 §1, docs/06 §6, docs/12 §8, ronda-4 §4).
// Material, color and brand join the workspace pick lists when they are new (docs/06 §15).
import { BusinessError, type AddSpoolInput, type AddSpoolOutput } from '@app/contract';
import { canonicalEntry, filamentKey, nextSpoolNumbers, normalizeName, splitCents, tidyName } from '@app/core';
import {
  addCatalogItems, findFilamentByKey, getFilament, getSupplier, insertFilament, insertSpool, insertSpoolMovements, maxSpoolNumber, transaction, updateFilament,
  type Ctx, type Executor, type FilamentRow,
} from '@app/db';
import type { Deps } from '../deps';
import { notFound } from '../http';
import { filamentOut } from '../views/filament-view';
import { loadCatalogs } from './settings';

/** Adds the brand to the pick list when it is new; returns its official spelling. */
export async function catalogBrand(deps: Deps, tx: Executor, ctx: Ctx, brand: string): Promise<string> {
  const catalogs = await loadCatalogs(tx, ctx);
  const b = canonicalEntry('brand', catalogs.brands, brand);
  if (b.isNew) await addCatalogItems(tx, ctx, [{ id: deps.ids.next(), kind: 'brand', name: b.name, nameKey: normalizeName(b.name) }]);
  return b.name || tidyName(brand);
}

export async function resolveFilament(deps: Deps, tx: Executor, ctx: Ctx, input: { filamentId?: string | undefined; filament?: { material: string; color: string; hex?: string | undefined } | undefined }): Promise<FilamentRow> {
  if (input.filamentId) {
    const f = await getFilament(tx, ctx, input.filamentId);
    if (!f) throw notFound('filament');
    return f;
  }
  const catalogs = await loadCatalogs(tx, ctx);
  const m = canonicalEntry('material', catalogs.materials, input.filament!.material);
  const c = canonicalEntry('color', catalogs.colors, input.filament!.color, input.filament!.hex);
  const fresh = [
    ...(m.isNew ? [{ id: deps.ids.next(), kind: 'material', name: m.name, nameKey: normalizeName(m.name) }] : []),
    ...(c.isNew ? [{ id: deps.ids.next(), kind: 'color', name: c.name, nameKey: normalizeName(c.name), hex: c.hex }] : []),
  ];
  await addCatalogItems(tx, ctx, fresh);
  const key = filamentKey(m.name, c.name);
  return (await findFilamentByKey(tx, ctx, key)) ?? insertFilament(tx, ctx, { id: deps.ids.next(), material: m.name, color: c.name, hex: c.hex!, nameKey: key });
}

export async function addSpool(deps: Deps, ctx: Ctx, input: AddSpoolInput): Promise<AddSpoolOutput> {
  return transaction(deps.db, async (tx) => {
    let filament = await resolveFilament(deps, tx, ctx, input);
    if (input.supplierId && !(await getSupplier(tx, ctx, input.supplierId))) throw notFound('supplier');
    const brand = input.brand ? await catalogBrand(deps, tx, ctx, input.brand) : '';
    if (input.referenceCentsPerKg !== undefined) filament = (await updateFilament(tx, ctx, filament.id, { referenceCentsPerKg: input.referenceCentsPerKg }))!;
    const quantity = input.quantity ?? 1;
    // A spool that cost nothing is a no-cost spool, whatever the switch says (decision of phase A, the same as migration 0008).
    const noCost = Boolean(input.noCost) || input.costCents + input.shippingCents === 0;
    const numbers = nextSpoolNumbers([await maxSpoolNumber(tx, ctx)], quantity);
    const shipping = splitCents(input.shippingCents, quantity);
    const ids = numbers.map(() => deps.ids.next());
    for (const [i, number] of numbers.entries()) {
      await insertSpool(tx, ctx, {
        id: ids[i]!, number, noCost, filamentId: filament.id, brand, costCents: input.costCents, shippingCents: shipping[i]!, grams: input.grams,
        purchasedOn: input.purchasedOn, supplierId: input.supplierId ?? null,
      });
    }
    await insertSpoolMovements(tx, ctx, ids.map((spoolId) => ({ id: deps.ids.next(), spoolId, on: input.purchasedOn, kind: 'purchase' as const, grams: input.grams, note: input.note ?? '' })));
    const o = await filamentOut(tx, ctx, filament.id);
    // A no-cost spool needs some way to cost pieces (docs/04 §1): purchases of the filament or its material, or a reference price.
    if (noCost && o.cost.source === 'none') throw new BusinessError('REFERENCE_COST_REQUIRED');
    const spools = ids.map(o.spool);
    return { spool: spools[0]!, spools, filament: o.filament };
  });
}
