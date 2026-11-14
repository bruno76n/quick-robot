// Ajustes › purchases for the average of a filament (docs/12 §4, docs/04 §1 cases 1.1a and 1.1f): 1–10, 3 by default;
// changing it changes the cost per gram of filaments and the cost of pieces; each workspace has its own.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addSpool } from '../../src/usecases/add-spool';
import { updateSettings } from '../../src/usecases/settings';
import { B_TOKEN, failOnWrite, makeHarness, validSpool, type Harness } from '../harness';

type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
let h: Harness;
let filamentId = '';
let productId = '';
beforeAll(async () => {
  h = await makeHarness();
  await updateSettings(h.deps, h.A, { purgePct: 0 }); // the case speaks of material without purge
  // Case 1.1a: PLA Gris #1 $200 (20 sep), #2 $250 (10 oct), #3 $300 (5 nov), #4 no-cost (15 sep).
  for (const [costCents, purchasedOn] of [[20000, '2026-09-20'], [25000, '2026-10-10'], [30000, '2026-11-05'], [0, '2026-09-15']] as const) {
    filamentId = (await addSpool(h.deps, h.A, validSpool({ filament: { material: 'PLA', color: 'Gris' }, costCents, shippingCents: 0, purchasedOn }))).filament.id;
  }
  productId = ((await h.call('POST', '/api/v1/products', { body: { name: 'Pieza 50 g', mode: 'value', priceCents: 10000, hours: 0, filaments: [{ filamentId, grams: 50 }], supplies: [] } })).json.data as J).id;
});
afterAll(() => h.close());

const filament = async (token?: string) => ((await h.call('GET', `/api/v1/filaments/${filamentId}`, token ? { token } : {})).json as J);
const material = async () => (((await h.call('GET', `/api/v1/products/${productId}`)).json.data as J).breakdown as J).materialCents;

describe('costAvgPurchases', () => {
  it('3 by default: (200 + 250 + 300) / 3,000 = $0.25/g; a 50 g piece has $12.50 of material', async () => {
    expect(((await h.call('GET', '/api/v1/settings')).json.data as J).settings.costAvgPurchases).toBe(3);
    expect((await filament()).data).toMatchObject({ costPerGram: 0.25, costSpoolNumbers: [3, 2, 1] });
    expect(await material()).toBe(1250);
  });

  it('case 1.1f: with N = 1 the filament costs its last purchase, #3 = $0.30/g, and the piece follows', async () => {
    const r = await h.call('PATCH', '/api/v1/settings', { body: { costAvgPurchases: 1 } });
    expect([r.status, (r.json.data as J).costAvgPurchases]).toEqual([200, 1]);
    expect((await filament()).data).toMatchObject({ costPerGram: 0.3, costSource: 'purchases', costSpoolNumbers: [3] });
    expect(await material()).toBe(1500);
  });

  it('N = 2: (250 + 300) / 2,000 = $0.275/g; another workspace keeps its 3', async () => {
    await updateSettings(h.deps, h.A, { costAvgPurchases: 2 });
    expect((await filament()).data).toMatchObject({ costPerGram: 0.275, costSpoolNumbers: [3, 2] });
    expect(((await h.call('GET', '/api/v1/settings', { token: B_TOKEN })).json.data as J).settings.costAvgPurchases).toBe(3);
    expect((await filament(B_TOKEN)).code).toBe('NOT_FOUND');
  });

  it.each([0, 11, 2.5, '3'])('%s → VALIDATION_ERROR, nothing changes', async (costAvgPurchases) => {
    const r = await h.call('PATCH', '/api/v1/settings', { body: { costAvgPurchases } });
    expect([r.status, r.json.code]).toEqual([422, 'VALIDATION_ERROR']);
    expect(((await h.call('GET', '/api/v1/settings')).json.data as J).settings.costAvgPurchases).toBe(2);
  });

  it('failing on the write leaves N as it was', async () => {
    await expect(updateSettings({ ...h.deps, db: failOnWrite(h.db, 1) }, h.A, { costAvgPurchases: 7 })).rejects.toThrow(/injected/);
    expect(((await h.call('GET', '/api/v1/settings')).json.data as J).settings.costAvgPurchases).toBe(2);
  });
});
