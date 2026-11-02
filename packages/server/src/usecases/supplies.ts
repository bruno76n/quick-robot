// Supplies (docs/04 §9, docs/06 §7, docs/12 §8): create, update, delete, restore, purchase and movements.
import {
  BusinessError, type CreateSupplyInput, type SupplyDetail, type SupplyListItem, type SupplyMovementInput, type SupplyPurchaseInput, type UpdateSupplyInput,
} from '@app/contract';
import { countDelta, normalizeName, round2, supplyStatus, tidyName } from '@app/core';
import {
  findSupplyByKey, getSupplier, getSupply, insertSupply, insertSupplyMovements, listSupplyMovements, productsUsingSupply, setSupplyDeleted,
  transaction, updateSupply as updateRow, type Ctx, type Executor, type SupplierRow, type SupplyRow,
} from '@app/db';
import type { Deps } from '../deps';
import { notFound } from '../http';

export function supplyListView(s: SupplyRow, supplier: SupplierRow | undefined): SupplyListItem {
  return {
    id: s.id, name: s.name, unit: s.unit, costCents: s.costCents, stock: s.stock, minimum: s.minimum, status: supplyStatus(s.stock, s.minimum), note: s.note,
    supplier: supplier && !supplier.deletedAt ? { id: supplier.id, name: supplier.name } : null,
  };
}

export async function supplyDetailView(ex: Executor, ctx: Ctx, id: string): Promise<SupplyDetail> {
  const s = await getSupply(ex, ctx, id);
  if (!s) throw notFound('supply');
  const sup = s.supplierId ? await getSupplier(ex, ctx, s.supplierId) : undefined;
  return {
    ...supplyListView(s, sup),
    movements: (await listSupplyMovements(ex, ctx, id)).map((m) => ({ id: m.id, on: m.on, kind: m.kind as 'purchase', qty: m.qty, note: m.note, refId: m.refId ?? null })),
    products: (await productsUsingSupply(ex, ctx, id)).map((p) => ({ id: p.id, name: p.name, qty: Number(p.qty) })),
  };
}

async function checkSupplier(tx: Executor, ctx: Ctx, supplierId: string | null | undefined) {
  if (supplierId && !(await getSupplier(tx, ctx, supplierId))) throw notFound('supplier');
}

export async function createSupply(deps: Deps, ctx: Ctx, input: CreateSupplyInput): Promise<SupplyDetail> {
  return transaction(deps.db, async (tx) => {
    const name = tidyName(input.name);
    const nameKey = normalizeName(name);
    const clash = await findSupplyByKey(tx, ctx, nameKey);
    if (clash) throw new BusinessError('SUPPLY_NAME_EXISTS', { name: clash.name });
    await checkSupplier(tx, ctx, input.supplierId);
    const s = await insertSupply(tx, ctx, { id: deps.ids.next(), name, nameKey, unit: tidyName(input.unit), costCents: input.costCents, minimum: input.minimum, note: input.note.trim(), supplierId: input.supplierId ?? null });
    if (input.initialStock && input.initialStock > 0) await insertSupplyMovements(tx, ctx, [{ id: deps.ids.next(), supplyId: s.id, on: deps.clock.today(), kind: 'purchase', qty: input.initialStock, note: '' }]);
    return supplyDetailView(tx, ctx, s.id);
  });
}

export async function updateSupply(deps: Deps, ctx: Ctx, id: string, input: UpdateSupplyInput): Promise<SupplyDetail> {
  return transaction(deps.db, async (tx) => {
    if (!(await getSupply(tx, ctx, id))) throw notFound('supply');
    const name = tidyName(input.name);
    const nameKey = normalizeName(name);
    const clash = await findSupplyByKey(tx, ctx, nameKey, id);
    if (clash) throw new BusinessError('SUPPLY_NAME_EXISTS', { name: clash.name });
    await checkSupplier(tx, ctx, input.supplierId);
    await updateRow(tx, ctx, id, { name, nameKey, unit: tidyName(input.unit), costCents: input.costCents, minimum: input.minimum, note: input.note.trim(), supplierId: input.supplierId ?? null });
    return supplyDetailView(tx, ctx, id);
  });
}

export async function deleteSupply(deps: Deps, ctx: Ctx, id: string): Promise<void> {
  await transaction(deps.db, async (tx) => {
    if (!(await getSupply(tx, ctx, id))) throw notFound('supply');
    const used = await productsUsingSupply(tx, ctx, id);
    if (used.length) throw new BusinessError('SUPPLY_IN_USE', { products: used.length });
    await setSupplyDeleted(tx, ctx, id, deps.clock.now());
  });
}

export async function restoreSupply(deps: Deps, ctx: Ctx, id: string): Promise<SupplyDetail> {
  return transaction(deps.db, async (tx) => {
    const s = await getSupply(tx, ctx, id, { deleted: true });
    if (!s) throw notFound('supply');
    if (await findSupplyByKey(tx, ctx, s.nameKey)) throw new BusinessError('RESTORE_CONFLICT', { entity: 'supply', reason: 'name_taken' });
    await setSupplyDeleted(tx, ctx, id, null);
    return supplyDetailView(tx, ctx, id);
  });
}

/** A purchase adds stock; if the total paid is given, the unit cost becomes total ÷ quantity (mockup). */
export async function recordSupplyPurchase(deps: Deps, ctx: Ctx, id: string, input: SupplyPurchaseInput): Promise<SupplyDetail> {
  return transaction(deps.db, async (tx) => {
    if (!(await getSupply(tx, ctx, id, { forUpdate: true }))) throw notFound('supply');
    await insertSupplyMovements(tx, ctx, [{ id: deps.ids.next(), supplyId: id, on: input.on, kind: 'purchase', qty: input.qty, note: input.note?.trim() ?? '' }]);
    if (input.costCents && input.costCents > 0) await updateRow(tx, ctx, id, { costCents: Math.round(input.costCents / input.qty) });
    return supplyDetailView(tx, ctx, id);
  });
}

/** Use, adjustment or waste, by difference or by the real count (docs/12 §8). */
export async function recordSupplyMovement(deps: Deps, ctx: Ctx, id: string, input: SupplyMovementInput): Promise<SupplyDetail> {
  return transaction(deps.db, async (tx) => {
    const s = await getSupply(tx, ctx, id, { forUpdate: true });
    if (!s) throw notFound('supply');
    let qty: number;
    if (input.mode === 'count') {
      qty = round2(countDelta(s.stock, input.value));
      if (qty === 0) throw new BusinessError('COUNT_UNCHANGED');
    } else {
      qty = input.kind === 'adjustment' ? input.value : -Math.abs(input.value);
      if (qty === 0) throw new BusinessError('VALIDATION_ERROR', { fields: [{ path: 'value', rule: 'required' }] });
    }
    if (qty < 0 && -qty > Math.max(0, s.stock) + 1e-9) throw new BusinessError('SUPPLY_INSUFFICIENT', { available: Math.max(0, s.stock) });
    await insertSupplyMovements(tx, ctx, [{ id: deps.ids.next(), supplyId: id, on: input.on, kind: input.kind, qty, note: input.note?.trim() ?? '' }]);
    return supplyDetailView(tx, ctx, id);
  });
}
