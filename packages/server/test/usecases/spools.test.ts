// Spool operations of ronda 4 (docs/12 §8, docs/04 §1): updateSpool with noCost, finishSpool and weighSpool.
// Happy path, each error, failure midway and another workspace (404).
import { listSpoolMovements } from '@app/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addSpool } from '../../src/usecases/add-spool';
import { finishSpool, recordSpoolMovement, updateSpool } from '../../src/usecases/spools';
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
