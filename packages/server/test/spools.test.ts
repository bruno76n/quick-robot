import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { filamentRepo, type Database } from '@app/db';
import { listFilaments } from '../src/queries/filaments';
import { addSpool } from '../src/usecases/add-spool';
import { deleteSpool, recordSpoolMovement, updateSpool } from '../src/usecases/spools';
import { ctxA, ctxB, spoolInput, testDatabase, useCaseDeps } from './helpers';

let database: Database;
let spoolId: string;
beforeAll(async () => {
  database = await testDatabase();
  spoolId = (await addSpool(useCaseDeps(database), ctxA, spoolInput({ color: 'Negro', hex: '#26242b' }))).spoolId;
});
afterAll(() => database.close());

describe('spools', () => {
  it('movements: consumption takes out, adjustment ±, never below zero', async () => {
    const deps = useCaseDeps(database);
    let r = await recordSpoolMovement(deps, ctxA, spoolId, { kind: 'consumption', grams: 100, note: 'Lote', on: '2026-10-10' });
    expect(r.filament.remainingGrams).toBe(900);
    r = await recordSpoolMovement(deps, ctxA, spoolId, { kind: 'adjustment', grams: -50, on: '2026-10-11' });
    expect(r.filament.remainingGrams).toBe(850);
    await expect(recordSpoolMovement(deps, ctxA, spoolId, { kind: 'failure', grams: 851, on: '2026-10-11' })).rejects.toMatchObject({ code: 'INSUFFICIENT_FILAMENT' });
    await expect(recordSpoolMovement(deps, ctxB, spoolId, { kind: 'waste', grams: 1, on: '2026-10-11' })).rejects.toMatchObject({ code: 'SPOOL_NOT_FOUND' });
    expect(r.filament.movements.map((m) => [m.kind, m.grams])).toEqual([['adjustment', -50], ['consumption', -100], ['purchase', 1000]]);
  });

  it('editing the grams adds an adjustment (the ledger only grows)', async () => {
    const r = await updateSpool(useCaseDeps(database), ctxA, spoolId, spoolInput({ color: 'Negro', grams: 1200, costCents: 40000 }));
    expect(r.filament.remainingGrams).toBe(1050);
    expect(r.filament.movements[0]).toMatchObject({ kind: 'adjustment', grams: 200, on: '2026-11-02' });
    expect(r.filament.spools[0]).toMatchObject({ grams: 1200, costCents: 40000 });
  });

  it('moving the only spool to another filament hides the empty one', async () => {
    const r = await updateSpool(useCaseDeps(database), ctxA, spoolId, spoolInput({ color: 'Gris', hex: '#8b8b96', grams: 1200 }));
    expect(r.filament.color).toBe('Gris');
    expect((await listFilaments(database.db, ctxA)).items.map((f) => f.color)).toEqual(['Gris']);
  });

  it('delete and restore ("Deshacer")', async () => {
    const deps = useCaseDeps(database);
    await deleteSpool(deps, ctxA, spoolId);
    expect((await listFilaments(database.db, ctxA)).items).toEqual([]);
    await expect(deleteSpool(deps, ctxA, spoolId)).rejects.toMatchObject({ code: 'SPOOL_NOT_FOUND' });
    await deleteSpool(deps, ctxA, spoolId, true);
    const list = await listFilaments(database.db, ctxA);
    expect(list.items.map((f) => [f.color, f.remainingGrams])).toEqual([['Gris', 1050]]);
    expect(await filamentRepo.getSpool(database.db, ctxB, spoolId, true)).toBeUndefined();
  });
});
