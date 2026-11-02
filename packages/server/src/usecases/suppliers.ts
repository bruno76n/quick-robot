// createSupplier, updateSupplier, deleteSupplier, restoreSupplier (docs/06 §11, docs/12 §8).
import type { SupplierInput, SupplierView } from '@app/contract';
import { tidyName } from '@app/core';
import { getSupplier, insertSupplier, setSupplierDeleted, transaction, updateSupplier as updateRow, type Ctx, type SupplierRow } from '@app/db';
import type { Deps } from '../deps';
import { notFound } from '../http';

export const supplierView = (s: SupplierRow): SupplierView => ({ id: s.id, name: s.name, phone: s.phone, brands: s.brands, note: s.note });
const clean = (i: SupplierInput) => ({ name: tidyName(i.name), phone: tidyName(i.phone), brands: tidyName(i.brands), note: i.note.trim() });

export async function createSupplier(deps: Deps, ctx: Ctx, input: SupplierInput) {
  return transaction(deps.db, async (tx) => supplierView(await insertSupplier(tx, ctx, { id: deps.ids.next(), ...clean(input) })));
}

export async function updateSupplier(deps: Deps, ctx: Ctx, id: string, input: SupplierInput) {
  return transaction(deps.db, async (tx) => {
    const r = await updateRow(tx, ctx, id, clean(input));
    if (!r) throw notFound('supplier');
    return supplierView(r);
  });
}

/** Soft delete: supplies and spools keep the link and show "sin proveedor" while it is deleted (docs/12 §8). */
export async function deleteSupplier(deps: Deps, ctx: Ctx, id: string) {
  await transaction(deps.db, async (tx) => {
    if (!(await setSupplierDeleted(tx, ctx, id, deps.clock.now()))) throw notFound('supplier');
  });
}

export async function restoreSupplier(deps: Deps, ctx: Ctx, id: string) {
  return transaction(deps.db, async (tx) => {
    if (!(await getSupplier(tx, ctx, id, { deleted: true }))) throw notFound('supplier');
    return supplierView((await setSupplierDeleted(tx, ctx, id, null))!);
  });
}
