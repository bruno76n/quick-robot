import { listFilaments, listSpoolMovements, listSpools } from '@app/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addSpool } from '../../src/usecases/add-spool';
import { deleteSpool } from '../../src/usecases/spools';
import { failOnWrite, makeHarness, validSpool, type Harness } from '../harness';

let h: Harness;
beforeAll(async () => { h = await makeHarness(); });
afterAll(() => h.close());

describe('addSpool', () => {
  it('creates filament + spool + purchase movement', async () => {
    const r = await addSpool(h.deps, h.A, validSpool());
    expect(r.filament).toMatchObject({ material: 'PLA', color: 'Blanco', remainingGrams: 1000, spoolCount: 1, costPerGram: 0.5, status: 'new' });
    expect(r.spool).toMatchObject({ number: 1, noCost: false, grams: 1000, remainingGrams: 1000, costCents: 45000, shippingCents: 5000, status: 'new' });
    const movs = await listSpoolMovements(h.db, h.A, r.filament.id);
    expect(movs).toHaveLength(1);
    expect(movs[0]).toMatchObject({ kind: 'purchase', grams: 1000, on: '2026-11-01' });
  });

  it('"pla  blanco" joins PLA Blanco and the cost per gram is weighted (case 1.1 shape)', async () => {
    const r = await addSpool(h.deps, h.A, validSpool({ filament: { material: 'pla ', color: ' blanco' }, costCents: 60000, shippingCents: 0 }));
    expect(r.filament.material).toBe('PLA');
    expect(r.filament.spoolCount).toBe(2);
    expect(r.filament.remainingGrams).toBe(2000);
    expect(r.filament.costPerGram).toBe(0.55);
    expect((await listFilaments(h.db, h.A, { page: 1, pageSize: 50 })).total).toBe(1);
  });

  it('adds to an existing filament by id; an id of another workspace is NOT_FOUND', async () => {
    const [f] = (await listFilaments(h.db, h.A, { page: 1, pageSize: 50 })).items;
    const r = await addSpool(h.deps, h.A, { ...validSpool({ filament: undefined }), filamentId: f!.id } as never);
    expect(r.filament.spoolCount).toBe(3);
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

describe('cost per gram of ronda 4 (docs/04 §1, cases 1.1a and 1.1d)', () => {
  it('last purchases with cost; a $0 spool does not count (nor adds value), and a filament with only that takes its material cost', async () => {
    const spool = (color: string, costCents: number, purchasedOn: string) => addSpool(h.deps, h.B, validSpool({ filament: { material: 'PLA', color }, costCents, shippingCents: 0, purchasedOn }));
    await spool('Gris', 20000, '2026-09-20');
    await spool('Gris', 25000, '2026-10-10');
    const gift = await spool('Gris', 0, '2026-09-15');
    const gray = await spool('Gris', 30000, '2026-11-05');
    expect(gray.filament.costPerGram).toBe(0.25);
    expect(gift.filament.spoolCount).toBe(3);
    const white = await spool('Blanco', 0, '2026-08-01');
    expect(white.filament.costPerGram).toBe(0.25);
    expect(white.filament.valueCents).toBe(0);
  });
});

describe('addSpool of ronda 4: quantity, numbers, shipping, no-cost spools and the reference price (docs/12 §8)', () => {
  let r4: Harness;
  beforeAll(async () => { r4 = await makeHarness(); });
  afterAll(() => r4.close());
  const add = (over: Record<string, unknown>, ctx = r4.A) => addSpool(r4.deps, ctx, validSpool({ filament: { material: 'PLA', color: 'Gris' }, shippingCents: 0, ...over }) as never);

  it('quantity 2 creates two equal spools with consecutive numbers and a purchase movement each', async () => {
    const one = await add({ costCents: 20000 });
    const two = await add({ costCents: 25000, quantity: 2 });
    expect(one.spools.map((s) => s.number)).toEqual([1]);
    expect(two.spools.map((s) => s.number)).toEqual([2, 3]);
    expect(two.spool).toEqual(two.spools[0]);
    expect(two.spools.every((s) => s.costCents === 25000 && s.grams === 1000 && s.remainingGrams === 1000 && !s.noCost)).toBe(true);
    expect(two.filament).toMatchObject({ spoolCount: 3, remainingGrams: 3000 });
    const movs = await listSpoolMovements(r4.db, r4.A, two.filament.id);
    expect(movs.filter((m) => m.kind === 'purchase')).toHaveLength(3);
  });

  it('a deleted spool keeps its number: the next ones are never reused, also when the last one was deleted', async () => {
    const mid = await add({ costCents: 20000 });
    expect(mid.spool.number).toBe(4);
    await add({ costCents: 20000 });
    await deleteSpool(r4.deps, r4.A, mid.spool.id);
    expect((await add({ costCents: 20000 })).spool.number).toBe(6);
    const last = await add({ costCents: 20000 });
    await deleteSpool(r4.deps, r4.A, last.spool.id);
    expect((await add({ costCents: 20000, quantity: 2 })).spools.map((s) => s.number)).toEqual([8, 9]);
  });

  it('another workspace numbers its spools from 1', async () => {
    expect((await add({ costCents: 20000, quantity: 2 }, r4.B)).spools.map((s) => s.number)).toEqual([1, 2]);
  });

  it('the shipping of the order is split between the spools; the cents left over go to the first', async () => {
    const r = await add({ filament: { material: 'PETG', color: 'Envío' }, costCents: 25000, shippingCents: 1000, quantity: 3 });
    expect(r.spools.map((s) => s.shippingCents)).toEqual([334, 333, 333]);
    // (3 × 250 + 10) / 3,000 g
    expect(r.filament.costPerGram).toBeCloseTo(760 / 3000, 8);
  });

  it('a no-cost spool counts in grams, not in cost; a spool that cost $0 is one too', async () => {
    const gift = await add({ costCents: 99900, noCost: true });
    expect(gift.spool).toMatchObject({ noCost: true, costPerGram: 0, costCents: 99900 });
    expect(gift.filament.costPerGram).toBe(0.2);
    expect((await add({ costCents: 0 })).spool.noCost).toBe(true);
  });

  it('no-cost without purchases of the filament nor of its material and without a reference price → REFERENCE_COST_REQUIRED, nothing written', async () => {
    const before = (await listFilaments(r4.db, r4.A, { page: 1, pageSize: 50 })).total;
    await expect(add({ filament: { material: 'ASA', color: 'Naranja' }, costCents: 0, noCost: true, quantity: 2 })).rejects.toMatchObject({ code: 'REFERENCE_COST_REQUIRED' });
    expect((await listFilaments(r4.db, r4.A, { page: 1, pageSize: 50 })).total).toBe(before);
  });

  it('with a reference price per kg it is saved on the filament and costs pieces (case 1.1e: $300 per kg → $0.30/g)', async () => {
    const r = await add({ filament: { material: 'ASA', color: 'Naranja' }, costCents: 0, noCost: true, referenceCentsPerKg: 30000 });
    expect(r.filament).toMatchObject({ referenceCentsPerKg: 30000, costSource: 'reference', costPerGram: 0.3, costSpoolNumbers: [], noCostSpools: 1 });
    // The reference is remembered: a second gift needs nothing else.
    expect((await add({ filamentId: r.filament.id, filament: undefined, costCents: 0, noCost: true })).filament.costSource).toBe('reference');
  });

  it('a $0 spool sent without the «Sin costo» mark (older clients, the importer) is kept without asking for a reference', async () => {
    const r = await add({ filament: { material: 'Nylon', color: 'Viejo' }, costCents: 0 });
    expect([r.spool.noCost, r.filament.costSource, r.filament.costPerGram]).toEqual([true, 'none', 0]);
  });

  it('a no-cost spool of a filament whose material has purchases takes the material (case 1.1d)', async () => {
    const r = await add({ filament: { material: 'PLA', color: 'Blanco regalo' }, costCents: 0, noCost: true });
    expect(r.filament).toMatchObject({ costSource: 'material', costPerGram: 0.2 });
  });

  it('quantity out of 1–20 and a reference of 0 are VALIDATION_ERROR', async () => {
    for (const body of [{ quantity: 0 }, { quantity: 21 }, { quantity: 1.5 }, { referenceCentsPerKg: 0 }]) {
      const res = await r4.call('POST', '/api/v1/spools', { body: validSpool(body) });
      expect([res.status, res.json.code]).toEqual([422, 'VALIDATION_ERROR']);
    }
  });

  it.each([1, 2, 3, 4, 5, 6, 7])('quantity 2 failing on write #%i leaves nothing written', async (n) => {
    const before = await listFilaments(r4.db, r4.A, { page: 1, pageSize: 50 });
    const spools = await listSpools(r4.db, r4.A, before.items.map((f) => f.id));
    const deps = { ...r4.deps, db: failOnWrite(r4.db, n) };
    await expect(addSpool(deps, r4.A, validSpool({ filament: { material: 'PETG', color: `Mitad ${n}` }, brand: `Marca ${n}`, quantity: 2, referenceCentsPerKg: 30000 }) as never)).rejects.toThrow(/injected/);
    const after = await listFilaments(r4.db, r4.A, { page: 1, pageSize: 50 });
    expect(after.total).toBe(before.total);
    expect(await listSpools(r4.db, r4.A, after.items.map((f) => f.id))).toHaveLength(spools.length);
  });
});
