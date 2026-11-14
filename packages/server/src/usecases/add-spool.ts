// addSpool — register a spool purchase; creates the filament if it does not exist (docs/04 §1, docs/06 §6, docs/12 §8).
// Material, color and brand join the workspace pick lists when they are new (docs/06 §15).
import type { AddSpoolInput, AddSpoolOutput } from '@app/contract';
import { canonicalEntry, filamentKey, normalizeName, tidyName } from '@app/core';
import {
  addCatalogItems, findFilamentByKey, getFilament, getSupplier, insertFilament, insertSpool, insertSpoolMovements, listSpools, transaction,
  type Ctx, type Executor, type FilamentRow,
} from '@app/db';
import type { Deps } from '../deps';
import { notFound } from '../http';
import { filamentListView, loadFilamentCosts, spoolView } from '../views/filament-view';
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
    const filament = await resolveFilament(deps, tx, ctx, input);
    if (input.supplierId && !(await getSupplier(tx, ctx, input.supplierId))) throw notFound('supplier');
    const brand = input.brand ? await catalogBrand(deps, tx, ctx, input.brand) : '';
    const spool = await insertSpool(tx, ctx, {
      id: deps.ids.next(), filamentId: filament.id, brand, costCents: input.costCents,
      shippingCents: input.shippingCents, grams: input.grams, purchasedOn: input.purchasedOn, supplierId: input.supplierId ?? null,
    });
    await insertSpoolMovements(tx, ctx, [{ id: deps.ids.next(), spoolId: spool.id, on: input.purchasedOn, kind: 'purchase', grams: input.grams, note: input.note ?? '' }]);
    const spools = await listSpools(tx, ctx, [filament.id]);
    return { spool: spoolView(spools.find((s) => s.id === spool.id)!), filament: filamentListView(filament, spools, await loadFilamentCosts(tx, ctx)) };
  });
}
