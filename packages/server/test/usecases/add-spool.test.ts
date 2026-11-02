import { listFilaments, listSpoolMovements, listSpools } from '@app/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addSpool } from '../../src/usecases/add-spool';
import { failOnWrite, makeHarness, validSpool, type Harness } from '../harness';

let h: Harness;
beforeAll(async () => { h = await makeHarness(); });
afterAll(() => h.close());

describe('addSpool', () => {
  it('creates filament + spool + purchase movement', async () => {
    const r = await addSpool(h.deps, h.A, validSpool());
    expect(r.filament).toMatchObject({ material: 'PLA', color: 'Blanco', remainingGrams: 1000, spools: 1, costPerGram: 0.5, status: 'new' });
    expect(r.spool).toMatchObject({ grams: 1000, remainingGrams: 1000, costCents: 45000, shippingCents: 5000, status: 'new' });
    const movs = await listSpoolMovements(h.db, h.A, r.filament.id);
    expect(movs).toHaveLength(1);
    expect(movs[0]).toMatchObject({ kind: 'purchase', grams: 1000, on: '2026-11-01' });
  });

  it('"pla  blanco" joins PLA Blanco and the cost per gram is weighted (case 1.1 shape)', async () => {
    const r = await addSpool(h.deps, h.A, validSpool({ filament: { material: 'pla ', color: ' blanco' }, costCents: 60000, shippingCents: 0 }));
    expect(r.filament.material).toBe('PLA');
    expect(r.filament.spools).toBe(2);
    expect(r.filament.remainingGrams).toBe(2000);
    expect(r.filament.costPerGram).toBe(0.55);
    expect((await listFilaments(h.db, h.A, { page: 1, pageSize: 50 })).total).toBe(1);
  });

  it('adds to an existing filament by id; an id of another workspace is NOT_FOUND', async () => {
    const [f] = (await listFilaments(h.db, h.A, { page: 1, pageSize: 50 })).items;
    const r = await addSpool(h.deps, h.A, { ...validSpool({ filament: undefined }), filamentId: f!.id } as never);
    expect(r.filament.spools).toBe(3);
    await expect(addSpool(h.deps, h.B, { ...validSpool({ filament: undefined }), filamentId: f!.id } as never)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('writes only in its own workspace', async () => {
    expect((await listFilaments(h.db, h.B, { page: 1, pageSize: 50 })).total).toBe(0);
  });

  it.each([1, 2, 3])('failing on write #%i leaves nothing written', async (n) => {
    const before = await listFilaments(h.db, h.A, { page: 1, pageSize: 50 });
    const deps = { ...h.deps, db: failOnWrite(h.db, n) };
    await expect(addSpool(deps, h.A, validSpool({ filament: { material: 'PETG', color: `Verde ${n}` } }))).rejects.toThrow(/injected/);
    const after = await listFilaments(h.db, h.A, { page: 1, pageSize: 50 });
    expect(after.total).toBe(before.total);
    const spools = await listSpools(h.db, h.A, after.items.map((f) => f.id));
    expect(spools).toHaveLength(3);
  });
});
