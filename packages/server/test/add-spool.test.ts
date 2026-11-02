import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { filamentRepo, type Database } from '@app/db';
import { BusinessError } from '@app/contract';
import { addSpool } from '../src/usecases/add-spool';
import { localEntitlements } from '../src/providers/local/entitlements';
import { listFilaments } from '../src/queries/filaments';
import { ctxA, ctxB, spoolInput, testDatabase } from './helpers';

let database: Database;
beforeAll(async () => {
  database = await testDatabase();
});
afterAll(() => database.close());
const deps = () => ({ database, entitlements: localEntitlements });

describe('addSpool', () => {
  it('creates the filament, the spool and a purchase movement', async () => {
    const r = await addSpool(deps(), ctxA, spoolInput());
    expect(r.createdFilament).toBe(true);
    expect(r.filament).toMatchObject({ material: 'PLA', color: 'Blanco', remainingGrams: 1000, spoolCount: 1, status: 'new' });
    expect(r.filament.costPerGram).toBeCloseTo(0.39, 10);
    expect(r.filament.movements).toHaveLength(1);
    expect(r.filament.movements[0]).toMatchObject({ kind: 'purchase', grams: 1000, on: '2026-10-01' });
  });

  it('"pla  blanco" joins the existing PLA Blanco; cost per gram is weighted (server recalculates)', async () => {
    const r = await addSpool(deps(), ctxA, spoolInput({ material: 'pla', color: '  blanco ', brand: 'Sunlu', costCents: 33000, purchasedOn: '2026-10-20' }));
    expect(r.createdFilament).toBe(false);
    expect(r.filament.spoolCount).toBe(2);
    expect(r.filament.remainingGrams).toBe(2000);
    expect(r.filament.costPerGram).toBeCloseTo((390 + 370) / 2000, 10);
    expect(r.filament.brands.sort()).toEqual(['Bambu Lab', 'Sunlu']);
  });

  it('rejects invalid input before writing anything', async () => {
    await expect(addSpool(deps(), ctxA, spoolInput({ costCents: 0 }))).rejects.toThrow();
    await expect(addSpool(deps(), ctxA, spoolInput({ grams: -5 }))).rejects.toThrow();
  });

  it('respects entitlements (cloud plan limits)', async () => {
    const denied = { assert: async () => { throw new BusinessError('PLAN_LIMIT'); } };
    await expect(addSpool({ database, entitlements: denied }, ctxA, spoolInput({ color: 'Verde' }))).rejects.toMatchObject({ code: 'PLAN_LIMIT' });
  });

  it('is atomic: if the movement insert fails, no filament or spool is left behind', async () => {
    const before = await listFilaments(database.db, ctxA);
    const spy = vi.spyOn(filamentRepo, 'insertMovement').mockRejectedValueOnce(new Error('boom'));
    await expect(addSpool(deps(), ctxA, spoolInput({ material: 'PETG', color: 'Negro' }))).rejects.toThrow('boom');
    spy.mockRestore();
    const after = await listFilaments(database.db, ctxA);
    expect(after).toEqual(before);
    expect(await filamentRepo.findByKey(database.db, ctxA, 'petg|negro')).toBeUndefined();
  });

  it('writes only into the caller business', async () => {
    await addSpool(deps(), ctxB, spoolInput({ color: 'Rojo' }));
    const a = await listFilaments(database.db, ctxA);
    expect(a.items.map((f) => f.color)).toEqual(['Blanco']);
  });
});
