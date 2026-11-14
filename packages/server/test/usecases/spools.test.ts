// Spool operations of ronda 4 (docs/12 §8, docs/04 §1): updateSpool with noCost, finishSpool and weighSpool.
// Happy path, each error, failure midway and another workspace (404).
import { listCatalog, listSpoolMovements } from '@app/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addSpool } from '../../src/usecases/add-spool';
import { finishSpool, recordSpoolMovement, updateSpool, weighSpool } from '../../src/usecases/spools';
import { B_TOKEN, failOnWrite, makeHarness, validSpool, type Harness } from '../harness';

let h: Harness;
beforeAll(async () => { h = await makeHarness(); });
afterAll(() => h.close());

const gray = (over: Record<string, unknown> = {}) => addSpool(h.deps, h.A, validSpool({ filament: { material: 'PLA', color: 'Gris' }, shippingCents: 0, ...over }) as never);

describe('updateSpool + noCost', () => {
  it('marking a spool as no-cost takes it out of the average; unmarking puts it back; its number never changes', async () => {
    await gray({ costCents: 20000, purchasedOn: '2026-09-20' });
    const b = await gray({ costCents: 40000, purchasedOn: '2026-10-10' });
    expect(b.filament.costPerGram).toBe(0.3);
    const off = await updateSpool(h.deps, h.A, b.spool.id, { noCost: true });
    expect(off.spool).toMatchObject({ noCost: true, costPerGram: 0, costCents: 40000, number: b.spool.number });
    expect(off.filament).toMatchObject({ costPerGram: 0.2, costSpoolNumbers: [1] });
    const on = await updateSpool(h.deps, h.A, b.spool.id, { noCost: false });
    expect(on.filament).toMatchObject({ costPerGram: 0.3, costSpoolNumbers: [2, 1] });
  });

  it('the value of the inventory in Reportes counts a no-cost spool as $0 (docs/04 §1, case 1.4)', async () => {
    const s = await addSpool(h.deps, h.B, validSpool({ filament: { material: 'PLA', color: 'Valor' }, costCents: 30000, shippingCents: 0 }) as never);
    const value = async () => ((await h.call('GET', '/api/v1/reports?period=all', { token: B_TOKEN })).json.data as { inventory: { valueCents: number } }).inventory.valueCents;
    expect(await value()).toBe(30000);
    await updateSpool(h.deps, h.B, s.spool.id, { noCost: true });
    expect(await value()).toBe(0);
  });

  it('a price of $0 makes it a no-cost spool even if the switch says otherwise', async () => {
    const s = await gray({ costCents: 10000, purchasedOn: '2026-08-01' });
    expect((await updateSpool(h.deps, h.A, s.spool.id, { costCents: 0, noCost: false })).spool.noCost).toBe(true);
  });

  it('a spool of another workspace is NOT_FOUND (also through the route) and nothing changes', async () => {
    const s = await gray({ costCents: 10000 });
    await expect(updateSpool(h.deps, h.B, s.spool.id, { noCost: true })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await h.call('PATCH', `/api/v1/spools/${s.spool.id}`, { token: B_TOKEN, body: { noCost: true } })).status).toBe(404);
    expect((await h.call('PATCH', `/api/v1/spools/${s.spool.id}`, { body: { noCost: 'yes' } })).status).toBe(422);
  });

  it.each([1, 2])('failing on write #%i leaves the spool as it was', async (n) => {
    const s = await gray({ costCents: 10000, purchasedOn: '2026-07-01' });
    await expect(updateSpool({ ...h.deps, db: failOnWrite(h.db, n) }, h.A, s.spool.id, { noCost: true, grams: 900 })).rejects.toThrow(/injected/);
    const again = await h.call('GET', `/api/v1/filaments/${s.filament.id}`);
    const spool = (again.json.data as { spools: { id: string; noCost: boolean; grams: number }[] }).spools.find((x) => x.id === s.spool.id)!;
    expect([spool.noCost, spool.grams]).toEqual([false, 1000]);
    expect((await listSpoolMovements(h.db, h.A, s.filament.id)).filter((m) => m.spoolId === s.spool.id)).toHaveLength(1);
  });
});

describe('finishSpool (docs/04 §1, terminar rollo)', () => {
  it('records a waste movement for all that is left, noted «Rollo terminado»; the spool is empty and the filament drops', async () => {
    const s = await gray({ filament: { material: 'PETG', color: 'Fin' }, costCents: 30000, purchasedOn: '2026-10-01' });
    await recordSpoolMovement(h.deps, h.A, s.spool.id, { kind: 'consumption', grams: -900, on: '2026-10-02' });
    const r = await finishSpool(h.deps, h.A, s.spool.id, { on: '2026-11-03' });
    expect(r.spool).toMatchObject({ remainingGrams: 0, status: 'empty', number: s.spool.number });
    expect(r.filament.remainingGrams).toBe(0);
    const [m] = await listSpoolMovements(h.db, h.A, s.filament.id);
    expect(m).toMatchObject({ kind: 'waste', grams: -100, note: 'Rollo terminado', on: '2026-11-03', spoolId: s.spool.id });
    // The cost is the price of the purchase: an empty spool still counts in the average (case 1.1a).
    expect(r.filament.costPerGram).toBe(0.3);
  });

  it('without a date it is today; through the route the body may be left out', async () => {
    const s = await gray({ filament: { material: 'PETG', color: 'Hoy' }, costCents: 30000 });
    const res = await h.call('POST', `/api/v1/spools/${s.spool.id}/finish`);
    expect(res.status).toBe(200);
    expect((await listSpoolMovements(h.db, h.A, s.filament.id))[0]).toMatchObject({ kind: 'waste', grams: -1000, on: h.deps.clock.today() });
  });

  it('an empty spool (0.5 g or less) → SPOOL_ALREADY_EMPTY 409, nothing written', async () => {
    const s = await gray({ filament: { material: 'PETG', color: 'Vacío' }, costCents: 30000 });
    await recordSpoolMovement(h.deps, h.A, s.spool.id, { kind: 'consumption', grams: -999.5, on: '2026-11-02' });
    const res = await h.call('POST', `/api/v1/spools/${s.spool.id}/finish`, { body: {} });
    expect([res.status, res.json.code]).toEqual([409, 'SPOOL_ALREADY_EMPTY']);
    expect(await listSpoolMovements(h.db, h.A, s.filament.id)).toHaveLength(2);
  });

  it('a spool of another workspace or a deleted one → 404; a bad body → 422', async () => {
    const s = await gray({ filament: { material: 'PETG', color: 'Ajeno' }, costCents: 30000 });
    expect((await h.call('POST', `/api/v1/spools/${s.spool.id}/finish`, { token: B_TOKEN })).status).toBe(404);
    await expect(finishSpool(h.deps, h.B, s.spool.id, {})).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await h.call('POST', `/api/v1/spools/${s.spool.id}/finish`, { body: { on: 'ayer' } })).status).toBe(422);
    expect((await h.call('POST', `/api/v1/spools/${s.spool.id}/finish`, { body: '{' })).status).toBe(422);
    await h.call('DELETE', `/api/v1/spools/${s.spool.id}`);
    expect((await h.call('POST', `/api/v1/spools/${s.spool.id}/finish`)).status).toBe(404);
  });

  it('failing on the write leaves the spool as it was', async () => {
    const s = await gray({ filament: { material: 'PETG', color: 'Mitad' }, costCents: 30000 });
    await expect(finishSpool({ ...h.deps, db: failOnWrite(h.db, 1) }, h.A, s.spool.id, {})).rejects.toThrow(/injected/);
    expect(await listSpoolMovements(h.db, h.A, s.filament.id)).toHaveLength(1);
  });
});

describe('weighSpool (docs/04 §1, pesar · case 1.6)', () => {
  const at100 = async (color: string, brand = 'Bambu Lab') => {
    const s = await gray({ filament: { material: 'PLA', color }, brand, costCents: 30000 });
    await recordSpoolMovement(h.deps, h.A, s.spool.id, { kind: 'consumption', grams: -900, on: '2026-11-02' });
    return s;
  };
  const tareOf = async (brand: string) => (await listCatalog(h.db, h.A, ['brand'])).find((b) => b.name === brand)?.spoolTareGrams;

  it('scale 348 g − Bambu Lab 248 g = 100 g, the same as the ledger: no movement; the tare is kept for the brand', async () => {
    const s = await at100('Pesar 1');
    const r = await weighSpool(h.deps, h.A, s.spool.id, { scaleGrams: 348, tareGrams: 248 });
    expect([r.leftGrams, r.adjustmentGrams, r.spool.remainingGrams]).toEqual([100, null, 100]);
    expect(await listSpoolMovements(h.db, h.A, s.filament.id)).toHaveLength(2);
    expect(await tareOf('Bambu Lab')).toBe(248);
    const settings = await h.call('GET', '/api/v1/settings');
    expect((settings.json.data as { catalogs: { brands: { name: string; tareGrams?: number | null }[] } }).catalogs.brands.find((b) => b.name === 'Bambu Lab')?.tareGrams).toBe(248);
  });

  it('scale 330 g → 82 g left: an adjustment of −18 g (through the route)', async () => {
    const s = await at100('Pesar 2');
    const res = await h.call('POST', `/api/v1/spools/${s.spool.id}/weigh`, { body: { scaleGrams: 330, tareGrams: 248, on: '2026-11-04' } });
    expect(res.status).toBe(200);
    expect(res.json.data).toMatchObject({ leftGrams: 82, adjustmentGrams: -18, spool: { remainingGrams: 82 }, filament: { remainingGrams: 82 } });
    expect((await listSpoolMovements(h.db, h.A, s.filament.id))[0]).toMatchObject({ kind: 'adjustment', grams: -18, on: '2026-11-04' });
  });

  it('a new tare replaces the one of the brand; a brand not in the list is added; a spool without brand keeps nothing', async () => {
    const s = await at100('Pesar 3');
    await weighSpool(h.deps, h.A, s.spool.id, { scaleGrams: 350, tareGrams: 250 });
    expect(await tareOf('Bambu Lab')).toBe(250);
    const other = await at100('Pesar 4', 'Marca Rara');
    await weighSpool(h.deps, h.A, other.spool.id, { scaleGrams: 300, tareGrams: 200 });
    expect(await tareOf('Marca Rara')).toBe(200);
    const plain = await at100('Pesar 5', '');
    const before = await listCatalog(h.db, h.A, ['brand']);
    expect((await weighSpool(h.deps, h.A, plain.spool.id, { scaleGrams: 300, tareGrams: 200 })).leftGrams).toBe(100);
    expect(await listCatalog(h.db, h.A, ['brand'])).toEqual(before);
  });

  it.each([
    ['below 0', 200, 248],
    ['above grams × 1.05', 1400, 248],
  ])('%s → WEIGHT_OUT_OF_RANGE 422 with maxGrams, nothing written', async (_n, scaleGrams, tareGrams) => {
    const s = await at100(`Fuera ${scaleGrams}`, 'Sin tara');
    const res = await h.call('POST', `/api/v1/spools/${s.spool.id}/weigh`, { body: { scaleGrams, tareGrams } });
    expect([res.status, res.json.code, res.json.details]).toEqual([422, 'WEIGHT_OUT_OF_RANGE', { maxGrams: 1050 }]);
    expect(await listSpoolMovements(h.db, h.A, s.filament.id)).toHaveLength(2);
    expect(await tareOf('Sin tara')).toBeNull();
  });

  it('the edge: exactly grams × 1.05 is valid', async () => {
    const s = await at100('Borde');
    expect((await weighSpool(h.deps, h.A, s.spool.id, { scaleGrams: 1300, tareGrams: 250 })).leftGrams).toBe(1050);
  });

  it('invalid input → 422; a spool of another workspace → 404', async () => {
    const s = await at100('Validar');
    for (const body of [{ scaleGrams: -1, tareGrams: 0 }, { scaleGrams: 100, tareGrams: 1.5 }, { scaleGrams: 100.25, tareGrams: 0 }, { scaleGrams: 100 }, { scaleGrams: 100, tareGrams: 10_001 }]) {
      expect((await h.call('POST', `/api/v1/spools/${s.spool.id}/weigh`, { body })).status).toBe(422);
    }
    expect((await h.call('POST', `/api/v1/spools/${s.spool.id}/weigh`, { token: B_TOKEN, body: { scaleGrams: 300, tareGrams: 200 } })).status).toBe(404);
    await expect(weighSpool(h.deps, h.B, s.spool.id, { scaleGrams: 300, tareGrams: 200 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it.each([1, 2])('failing on write #%i leaves the ledger and the tare as they were', async (n) => {
    const s = await at100(`Mitad ${n}`, `Tara ${n}`);
    await expect(weighSpool({ ...h.deps, db: failOnWrite(h.db, n) }, h.A, s.spool.id, { scaleGrams: 280, tareGrams: 200 })).rejects.toThrow(/injected/);
    expect(await listSpoolMovements(h.db, h.A, s.filament.id)).toHaveLength(2);
    expect(await tareOf(`Tara ${n}`)).toBeNull();
  });
});
