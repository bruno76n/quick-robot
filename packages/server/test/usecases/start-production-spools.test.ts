// startProduction with "Empezar con el rollo" (ronda-4 §4, docs/04 §1 case 1.5c, docs/12 §7): each item starts with its spool
// and the rest goes in the use order; SPOOL_NOT_IN_FILAMENT, another workspace (404), failure midway; without it, as before.
import { listSpools } from '@app/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addSpool } from '../../src/usecases/add-spool';
import { startProduction } from '../../src/usecases/sell/orders';
import { recordSpoolMovement } from '../../src/usecases/spools';
import { B_TOKEN, failOnWrite, makeHarness, validSpool, type Harness } from '../harness';

type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
let h: Harness;
let printerId = '';
let customerId = '';
let channelId = '';
const call = async (m: string, p: string, body?: unknown, token?: string) => {
  const r = await h.call(m, `/api/v1${p}`, { ...(body === undefined ? {} : { body }), ...(token ? { token } : {}) });
  return { status: r.status, data: (r.json as J)?.data as J, code: (r.json as J)?.code as string, details: (r.json as J)?.details as J };
};

beforeAll(async () => {
  h = await makeHarness();
  printerId = (await call('POST', '/printers', { name: 'P1', costCents: 600000, lifeHours: 3000, maintenanceCentsPerHour: 50, kw: 0.15 })).data.id;
  customerId = (await call('POST', '/customers', { name: 'Cliente', type: 'Persona' })).data.id;
  channelId = (await call('GET', '/settings')).data.channels[0].id;
});
afterAll(() => h.close());

let k = 0;
/** Case 1.5c: #a 410 g (opened), #b 1,000 g (newer), #c 1,000 g (the oldest, full); an accepted order of 20 pieces of 45 g. */
async function setup() {
  const color = `Naranja ${++k}`;
  const add = async (purchasedOn: string) => (await addSpool(h.deps, h.A, validSpool({ filament: { material: 'PLA', color }, purchasedOn }))).spool;
  const c = await add('2026-09-01');
  const a = await add('2026-10-01');
  const b = await add('2026-11-01');
  await recordSpoolMovement(h.deps, h.A, a.id, { kind: 'consumption', grams: -590, on: '2026-11-02' });
  const product = (await call('POST', '/products', { name: `Pieza ${color}`, mode: 'value', priceCents: 10000, hours: 1, filaments: [{ filamentId: a.filamentId, grams: 45 }], supplies: [] })).data;
  const order = (await call('POST', '/orders', { customerId, channelId, createdOn: '2026-11-01', dueOn: '2026-11-20', accepted: true, items: [{ kind: 'piece', productId: product.id, qty: 20, priceCents: 10000 }] })).data;
  return { filamentId: a.filamentId as string, a: a.id, b: b.id, c: c.id, orderId: order.id as string, lineItemId: order.items[0].id as string };
}
const left = async (filamentId: string) => new Map((await listSpools(h.db, h.A, [filamentId])).map((s) => [s.id, s.remainingGrams]));
const start = (x: Awaited<ReturnType<typeof setup>>, spoolId?: string, filamentId = x.filamentId, token?: string) =>
  call('POST', `/orders/${x.orderId}/start-production`, { assignments: [{ lineItemId: x.lineItemId, printerId, ...(spoolId ? { startSpools: [{ filamentId, spoolId }] } : {}) }], deductFilament: true }, token);

describe('startProduction with the spool each item starts with', () => {
  it('case 1.5c: 945 g starting with #a (410 g) → #a 0, then the use order: the oldest full #c 1,000 → 465', async () => {
    const x = await setup();
    const r = await start(x, x.a);
    expect([r.status, r.data.status]).toEqual([200, 'in_production']);
    const l = await left(x.filamentId);
    expect([l.get(x.a), l.get(x.c), l.get(x.b)]).toEqual([0, 465, 1000]);
  });

  it('the chosen spool wins over the use order: starting with the newest #b → 1,000 − 945 = 55; the opened #a is untouched', async () => {
    const x = await setup();
    await start(x, x.b);
    const l = await left(x.filamentId);
    expect([l.get(x.b), l.get(x.a), l.get(x.c)]).toEqual([55, 410, 1000]);
  });

  it('without startSpools: the automatic order as before (the opened spool, then the oldest)', async () => {
    const x = await setup();
    await start(x);
    const l = await left(x.filamentId);
    expect([l.get(x.a), l.get(x.c), l.get(x.b)]).toEqual([0, 465, 1000]);
  });

  it('a spool of another filament → SPOOL_NOT_IN_FILAMENT 422; the order and the spools stay as they were', async () => {
    const x = await setup();
    const y = await setup();
    const before = await left(x.filamentId);
    const r = await start(x, y.b);
    expect([r.status, r.code, r.details]).toEqual([422, 'SPOOL_NOT_IN_FILAMENT', { spoolId: y.b }]);
    expect(await left(x.filamentId)).toEqual(before);
    expect((await call('GET', `/orders/${x.orderId}`)).data.status).toBe('accepted');
  });

  it('a spool of another workspace → 404, also when production does not deduct filament', async () => {
    const x = await setup();
    const theirs = await addSpool(h.deps, h.B, validSpool({ filament: { material: 'PLA', color: 'Ajeno' } }));
    expect((await start(x, theirs.spool.id)).status).toBe(404);
    const r = await call('POST', `/orders/${x.orderId}/start-production`, { assignments: [{ lineItemId: x.lineItemId, printerId, startSpools: [{ filamentId: x.filamentId, spoolId: theirs.spool.id }] }], deductFilament: false });
    expect(r.status).toBe(404);
    expect((await start(x, x.a, x.filamentId, B_TOKEN)).status).toBe(404);
    expect((await call('GET', `/orders/${x.orderId}`)).data.status).toBe('accepted');
  });

  it('a start spool of a filament the item does not use is ignored', async () => {
    const x = await setup();
    const other = await addSpool(h.deps, h.A, validSpool({ filament: { material: 'PETG', color: 'Otro' } }));
    expect((await start(x, other.spool.id, other.filament.id)).status).toBe(200);
    const l = await left(x.filamentId);
    expect([l.get(x.a), l.get(x.c)]).toEqual([0, 465]);
  });

  it('any injected failure with a start spool → the order, its queue and the spools as they were', { timeout: 60_000 }, async () => {
    const x = await setup();
    const before = await left(x.filamentId);
    const input = { assignments: [{ lineItemId: x.lineItemId, printerId, startSpools: [{ filamentId: x.filamentId, spoolId: x.b }] }], deductFilament: true };
    let failures = 0;
    for (let n = 1; n <= 30; n++) {
      try { await startProduction({ ...h.deps, db: failOnWrite(h.db, n) }, h.A, x.orderId, input); break; } catch (e) {
        expect(String((e as Error).message)).toMatch(/injected/);
        failures += 1;
        expect(await left(x.filamentId)).toEqual(before);
        expect((await call('GET', `/orders/${x.orderId}`)).data).toMatchObject({ status: 'accepted', queue: [] });
      }
    }
    expect(failures).toBeGreaterThan(0);
    expect((await left(x.filamentId)).get(x.b)).toBe(55);
  });
});
