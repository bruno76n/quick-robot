// Attack strings in every text field of phase 2 are kept literally; limits of docs/15 §4: the exact value
// passes and one more fails with the right rule.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeHarness, type Harness } from '../harness';

let h: Harness;
beforeAll(async () => { h = await makeHarness(); });
afterAll(() => h.close());
const ATTACK = "'; DROP TABLE supply; -- <script>x</script> =HYPERLINK(\"a\")";

describe('injection in text fields', () => {
  it('supplier, supply, printer, product, collection, channel and settings keep the text as it is', async () => {
    const sup = await h.call('POST', '/api/v1/suppliers', { body: { name: ATTACK, phone: '=1+1', brands: '<b>', note: ATTACK } });
    expect(sup.json.data).toMatchObject({ name: ATTACK, phone: '=1+1', brands: '<b>', note: ATTACK });
    const supply = await h.call('POST', '/api/v1/supplies', { body: { name: ATTACK, unit: '<i>', costCents: 1, note: ATTACK } });
    expect(supply.json.data).toMatchObject({ name: ATTACK, unit: '<i>' });
    expect((await h.call('POST', '/api/v1/printers', { body: { name: ATTACK, costCents: 1, lifeHours: 1, maintenanceCentsPerHour: 0, kw: 0 } })).json.data).toMatchObject({ name: ATTACK });
    const p = await h.call('POST', '/api/v1/products', { body: { name: ATTACK, tags: ['<x>'], mode: 'value', priceCents: 1, hours: 1, note: ATTACK, spec: { file: '../../etc/passwd', note: ATTACK } } });
    expect(p.json.data).toMatchObject({ name: ATTACK, tags: ['<x>'], note: ATTACK, spec: { file: '../../etc/passwd' } });
    const id = (p.json.data as { id: string }).id;
    expect((await h.call('POST', '/api/v1/collections', { body: { name: ATTACK, parts: [{ productId: id, qty: 1 }], note: ATTACK } })).json.data).toMatchObject({ name: ATTACK });
    expect((await h.call('POST', '/api/v1/channels', { body: { name: ATTACK, commissionPct: 0 } })).json.data).toMatchObject({ name: ATTACK });
    expect((await h.call('PATCH', '/api/v1/settings', { body: { business: { footer: ATTACK, name: '<h1>' } } })).json.data).toMatchObject({ business: { footer: ATTACK, name: '<h1>' } });
    expect((await h.call('GET', '/api/v1/supplies')).json.data).toMatchObject({ total: 1 });
  });
});

describe('input limits (docs/15 §4)', () => {
  const product = (over: Record<string, unknown>) => ({ name: 'P', mode: 'value', priceCents: 1, hours: 1, ...over });
  it.each([
    ['name 120', '/api/v1/suppliers', { name: 'x'.repeat(120) }, { name: 'x'.repeat(121) }, 'name', 'too_long'],
    ['note 2000', '/api/v1/suppliers', { name: 'a', note: 'x'.repeat(2000) }, { name: 'a', note: 'x'.repeat(2001) }, 'note', 'too_long'],
    ['phone 40', '/api/v1/suppliers', { name: 'a', phone: 'x'.repeat(40) }, { name: 'a', phone: 'x'.repeat(41) }, 'phone', 'too_long'],
    ['unit price $1,000,000', '/api/v1/products', product({ priceCents: 100_000_000 }), product({ priceCents: 100_000_001 }), 'priceCents', 'too_big'],
    ['hours 1000', '/api/v1/products', product({ hours: 1000 }), product({ hours: 1000.01 }), 'hours', 'too_big'],
    ['12 tags', '/api/v1/products', product({ tags: Array.from({ length: 12 }, (_, i) => `t${i}`) }), product({ tags: Array.from({ length: 13 }, (_, i) => `t${i}`) }), 'tags', 'too_big'],
    ['percent 99', '/api/v1/channels', { name: 'c1', commissionPct: 99 }, { name: 'c2', commissionPct: 99.5 }, 'commissionPct', 'too_big'],
    ['spool grams 100 000', '/api/v1/spools', { filament: { material: 'PLA', color: 'L' }, costCents: 1, grams: 100_000, purchasedOn: '2026-11-01' }, { filament: { material: 'PLA', color: 'L' }, costCents: 1, grams: 100_000.1, purchasedOn: '2026-11-01' }, 'grams', 'too_big'],
    ['amount $10,000,000', '/api/v1/printers', { name: 'p', costCents: 1_000_000_000, lifeHours: 1, maintenanceCentsPerHour: 0, kw: 0 }, { name: 'p', costCents: 1_000_000_001, lifeHours: 1, maintenanceCentsPerHour: 0, kw: 0 }, 'costCents', 'too_big'],
  ])('%s', async (_n, path, okBody, badBody, field, rule) => {
    expect((await h.call('POST', path, { body: okBody })).status).toBe(201);
    const r = await h.call('POST', path, { body: badBody });
    expect(r.status).toBe(422);
    expect(r.json.details?.fields).toContainEqual(expect.objectContaining({ path: field, rule }));
  });
});
