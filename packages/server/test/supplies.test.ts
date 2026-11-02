import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { supplyRepo, type Database } from '@app/db';
import { listSupplies, getSupplyDetail } from '../src/queries/supplies';
import { createSupplier, createSupply, deleteSupplier, deleteSupply, recordSupplyMovement, recordSupplyPurchase, updateSupply } from '../src/usecases/supplies';
import { ctxA, ctxB, testDatabase, useCaseDeps } from './helpers';

let database: Database;
beforeAll(async () => {
  database = await testDatabase();
});
afterAll(() => database.close());
const base = { name: 'Argolla de llavero', unit: 'pza', costCents: 50, minimum: 30, note: '', on: '2026-10-01' };

describe('supplies', () => {
  it('create with initial inventory, status and value', async () => {
    const deps = useCaseDeps(database);
    const sup = await createSupplier(deps, ctxA, { name: 'Tornillería', phone: '33', brands: '' });
    const s = await createSupply(deps, ctxA, { ...base, supplierId: sup.id, initialQty: 12, initialNote: 'Inventario inicial' });
    expect(s).toMatchObject({ stock: 12, status: 'low', valueCents: 600, supplierName: 'Tornillería' });
    expect(s.movements).toMatchObject([{ kind: 'purchase', qty: 12, note: 'Inventario inicial' }]);
    await expect(createSupply(deps, ctxA, { ...base, name: 'argolla  DE llavero' })).rejects.toMatchObject({ code: 'DUPLICATE_NAME' });
  });

  it('purchase adds and updates unit cost = total / qty', async () => {
    const id = (await listSupplies(database.db, ctxA)).items[0]!.id;
    const s = await recordSupplyPurchase(useCaseDeps(database), ctxA, id, { qty: 200, totalCents: 11000, on: '2026-10-05' });
    expect(s).toMatchObject({ stock: 212, costCents: 55, status: 'enough' });
  });

  it('use / waste / real count; never more than there is; no-op count rejected', async () => {
    const deps = useCaseDeps(database);
    const id = (await listSupplies(database.db, ctxA)).items[0]!.id;
    expect((await recordSupplyMovement(deps, ctxA, id, { kind: 'use', qty: 2, on: '2026-10-06' })).stock).toBe(210);
    expect((await recordSupplyMovement(deps, ctxA, id, { kind: 'adjustment', qty: 205, on: '2026-10-06' })).stock).toBe(205);
    await expect(recordSupplyMovement(deps, ctxA, id, { kind: 'waste', qty: 206, on: '2026-10-06' })).rejects.toMatchObject({ code: 'INSUFFICIENT_SUPPLY' });
    await expect(recordSupplyMovement(deps, ctxA, id, { kind: 'adjustment', qty: 205, on: '2026-10-06' })).rejects.toMatchObject({ code: 'NO_CHANGE' });
    const d = await getSupplyDetail(database.db, ctxA, id);
    expect(d.movements[0]).toMatchObject({ kind: 'adjustment', qty: -5 });
  });

  it('deleted supplier → supply shows no supplier; restore brings it back', async () => {
    const deps = useCaseDeps(database);
    const s = (await listSupplies(database.db, ctxA)).items[0]!;
    await deleteSupplier(deps, ctxA, s.supplierId!);
    expect((await getSupplyDetail(database.db, ctxA, s.id)).supplierName).toBeNull();
    await deleteSupplier(deps, ctxA, s.supplierId!, true);
    expect((await getSupplyDetail(database.db, ctxA, s.id)).supplierName).toBe('Tornillería');
  });

  it('update, delete and restore; other business cannot touch it', async () => {
    const deps = useCaseDeps(database);
    const s = (await listSupplies(database.db, ctxA)).items[0]!;
    expect((await updateSupply(deps, ctxA, s.id, { ...base, minimum: 300, supplierId: s.supplierId })).status).toBe('low');
    await expect(updateSupply(deps, ctxB, s.id, { ...base, supplierId: null })).rejects.toMatchObject({ code: 'SUPPLY_NOT_FOUND' });
    await expect(recordSupplyMovement(deps, ctxB, s.id, { kind: 'use', qty: 1, on: '2026-10-06' })).rejects.toMatchObject({ code: 'SUPPLY_NOT_FOUND' });
    await deleteSupply(deps, ctxA, s.id);
    expect((await listSupplies(database.db, ctxA)).items).toEqual([]);
    await deleteSupply(deps, ctxA, s.id, true);
    expect((await listSupplies(database.db, ctxA)).items).toHaveLength(1);
  });

  it('is atomic: a failing purchase leaves no movement and no cost change', async () => {
    const s = (await listSupplies(database.db, ctxA)).items[0]!;
    const spy = vi.spyOn(supplyRepo, 'update').mockRejectedValueOnce(new Error('boom'));
    await expect(recordSupplyPurchase(useCaseDeps(database), ctxA, s.id, { qty: 10, totalCents: 9999, on: '2026-10-07' })).rejects.toThrow('boom');
    spy.mockRestore();
    const after = await getSupplyDetail(database.db, ctxA, s.id);
    expect(after.stock).toBe(s.stock);
    expect(after.costCents).toBe(s.costCents);
  });
});
