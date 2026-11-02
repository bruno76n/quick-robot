// Proveedores e Insumos (docs/06 §7): createSupplier/updateSupplier/deleteSupplier, createSupply (with initial
// inventory), updateSupply, deleteSupply (blocked while a piece uses it), recordSupplyPurchase, recordSupplyMovement.
import { BusinessError, CreateSupplyInput, SupplierInput, SupplyMovementInput, SupplyPurchaseInput, UpdateSupplyInput, type SavedId, type SupplyDetail } from '@app/contract';
import { fromCents, normalizeName, planSupplyMovement, toCents, unitCostAfterPurchase } from '@app/core';
import { supplierRepo, supplyRepo, type Ctx, type Executor } from '@app/db';
import { getSupplyDetail } from '../queries/supplies';
import type { UseCaseDeps } from './deps';

export async function createSupplier(deps: UseCaseDeps, ctx: Ctx, raw: unknown): Promise<SavedId> {
  const input = SupplierInput.parse(raw);
  return deps.database.transaction(async (tx) => ({ id: (await supplierRepo.insert(tx, ctx, input)).id }));
}

export async function updateSupplier(deps: UseCaseDeps, ctx: Ctx, id: string, raw: unknown): Promise<SavedId> {
  const input = SupplierInput.parse(raw);
  return deps.database.transaction(async (tx) => {
    if (!(await supplierRepo.update(tx, ctx, id, input))) throw new BusinessError('SUPPLIER_NOT_FOUND');
    return { id };
  });
}

/** Soft delete: supplies that had it show "sin proveedor"; restoring brings the link back. */
export async function deleteSupplier(deps: UseCaseDeps, ctx: Ctx, id: string, restore = false): Promise<void> {
  await deps.database.transaction(async (tx) => {
    if (!(await supplierRepo.setDeleted(tx, ctx, id, !restore))) throw new BusinessError('SUPPLIER_NOT_FOUND');
  });
}

async function assertSupplier(ex: Executor, ctx: Ctx, supplierId: string | null) {
  if (supplierId && !(await supplierRepo.get(ex, ctx, supplierId))) throw new BusinessError('SUPPLIER_NOT_FOUND');
}

async function assertUniqueSupply(ex: Executor, ctx: Ctx, nameKey: string, exceptId?: string) {
  const other = await supplyRepo.findByKey(ex, ctx, nameKey);
  if (other && other.id !== exceptId) throw new BusinessError('DUPLICATE_NAME', 'Supply name already exists');
}

export async function createSupply(deps: UseCaseDeps, ctx: Ctx, raw: unknown): Promise<SupplyDetail> {
  const input = CreateSupplyInput.parse(raw);
  await deps.entitlements.assert(ctx, 'supplies.create');
  return deps.database.transaction(async (tx) => {
    const nameKey = normalizeName(input.name);
    await assertUniqueSupply(tx, ctx, nameKey);
    await assertSupplier(tx, ctx, input.supplierId);
    const row = await supplyRepo.insert(tx, ctx, { name: input.name, nameKey, unit: input.unit, costCents: input.costCents, minimum: input.minimum, note: input.note, supplierId: input.supplierId });
    if (input.initialQty > 0) await supplyRepo.insertMovement(tx, ctx, { supplyId: row.id, on: input.on, kind: 'purchase', qty: input.initialQty, note: input.initialNote });
    return getSupplyDetail(tx, ctx, row.id);
  });
}

export async function updateSupply(deps: UseCaseDeps, ctx: Ctx, id: string, raw: unknown): Promise<SupplyDetail> {
  const input = UpdateSupplyInput.parse(raw);
  return deps.database.transaction(async (tx) => {
    if (!(await supplyRepo.get(tx, ctx, id))) throw new BusinessError('SUPPLY_NOT_FOUND');
    const nameKey = normalizeName(input.name);
    await assertUniqueSupply(tx, ctx, nameKey, id);
    await assertSupplier(tx, ctx, input.supplierId);
    await supplyRepo.update(tx, ctx, id, { ...input, nameKey });
    return getSupplyDetail(tx, ctx, id);
  });
}

/** Not while a piece uses it (mockup: "Quítalo de ellas primero"). Soft delete + restore. */
export async function deleteSupply(deps: UseCaseDeps, ctx: Ctx, id: string, restore = false): Promise<void> {
  await deps.database.transaction(async (tx) => {
    if (!restore) {
      if (!(await supplyRepo.get(tx, ctx, id))) throw new BusinessError('SUPPLY_NOT_FOUND');
      const used = await supplyRepo.usedBy(tx, ctx, [id]);
      if (used.length) throw new BusinessError('SUPPLY_IN_USE', 'Supply used by products', { products: used.length });
    }
    if (!(await supplyRepo.setDeleted(tx, ctx, id, !restore))) throw new BusinessError('SUPPLY_NOT_FOUND');
  });
}

/** Purchase: + qty; with the total paid, the unit cost becomes total / qty. */
export async function recordSupplyPurchase(deps: UseCaseDeps, ctx: Ctx, id: string, raw: unknown): Promise<SupplyDetail> {
  const input = SupplyPurchaseInput.parse(raw);
  return deps.database.transaction(async (tx) => {
    const s = await supplyRepo.getForUpdate(tx, ctx, id);
    if (!s) throw new BusinessError('SUPPLY_NOT_FOUND');
    await supplyRepo.insertMovement(tx, ctx, { supplyId: id, on: input.on, kind: 'purchase', qty: input.qty, note: input.note });
    const cost = unitCostAfterPurchase(fromCents(s.costCents), input.qty, input.totalCents == null ? null : fromCents(input.totalCents));
    if (toCents(cost) !== s.costCents) await supplyRepo.update(tx, ctx, id, { costCents: toCents(cost) });
    return getSupplyDetail(tx, ctx, id);
  });
}

/** Use / waste / real count. Never takes more than there is. */
export async function recordSupplyMovement(deps: UseCaseDeps, ctx: Ctx, id: string, raw: unknown): Promise<SupplyDetail> {
  const input = SupplyMovementInput.parse(raw);
  return deps.database.transaction(async (tx) => {
    if (!(await supplyRepo.getForUpdate(tx, ctx, id))) throw new BusinessError('SUPPLY_NOT_FOUND');
    const stock = (await supplyRepo.stockBySupply(tx, ctx)).get(id) ?? 0;
    const plan = planSupplyMovement(input.kind, input.qty, stock);
    if (!plan.ok) {
      if (plan.reason === 'no_change') throw new BusinessError('NO_CHANGE');
      if (plan.reason === 'insufficient') throw new BusinessError('INSUFFICIENT_SUPPLY', 'Not enough supply', { available: stock });
      throw new BusinessError('VALIDATION_FAILED', 'Invalid quantity');
    }
    await supplyRepo.insertMovement(tx, ctx, { supplyId: id, on: input.on, kind: input.kind, qty: plan.delta, note: input.note });
    return getSupplyDetail(tx, ctx, id);
  });
}

