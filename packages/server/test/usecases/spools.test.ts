// Spool operations of ronda 4 (docs/12 §8, docs/04 §1): updateSpool with noCost, finishSpool and weighSpool.
// Happy path, each error, failure midway and another workspace (404).
import { listSpoolMovements } from '@app/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addSpool } from '../../src/usecases/add-spool';
import { updateSpool } from '../../src/usecases/spools';
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
