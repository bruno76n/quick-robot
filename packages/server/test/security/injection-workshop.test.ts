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
    // A variant label is kept literally too, and shows inside displayName and in the search of variants.
    const label = "<img src=x onerror=alert(1)> %_' OR 1=1 --";
    const v = await h.call('POST', `/api/v1/products/${id}/variant`, { body: { name: 'V', mode: 'value', priceCents: 1, hours: 1, variantLabel: label } });
    expect(v.json.data).toMatchObject({ variantLabel: label, displayName: `${ATTACK} · ${label}`, parentId: id });
    const found = await h.call('GET', `/api/v1/products?q=${encodeURIComponent("%_' OR 1=1")}`);
    expect((found.json.data as { items: { id: string; matchedByVariant: boolean }[] }).items.map((f) => [f.id, f.matchedByVariant])).toEqual([[id, true]]);
    expect((await h.call('GET', '/api/v1/products?q=%25%25')).json.data).toMatchObject({ total: 0 });
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
    ['variant label 60', '/api/v1/products/:id/variant', product({ variantLabel: 'x'.repeat(60) }), product({ variantLabel: 'x'.repeat(61) }), 'variantLabel', 'too_long'],
    ['variant label required', '/api/v1/products/:id/variant', product({ variantLabel: 'x' }), product({ variantLabel: '   ' }), 'variantLabel', 'required'],
    ['percent 99', '/api/v1/channels', { name: 'c1', commissionPct: 99 }, { name: 'c2', commissionPct: 99.5 }, 'commissionPct', 'too_big'],
    ['spool grams 100 000', '/api/v1/spools', { filament: { material: 'PLA', color: 'L' }, costCents: 1, grams: 100_000, purchasedOn: '2026-11-01' }, { filament: { material: 'PLA', color: 'L' }, costCents: 1, grams: 100_000.1, purchasedOn: '2026-11-01' }, 'grams', 'too_big'],
    ['amount $10,000,000', '/api/v1/printers', { name: 'p', costCents: 1_000_000_000, lifeHours: 1, maintenanceCentsPerHour: 0, kw: 0 }, { name: 'p', costCents: 1_000_000_001, lifeHours: 1, maintenanceCentsPerHour: 0, kw: 0 }, 'costCents', 'too_big'],
  ])('%s', async (_n, rawPath, okBody, badBody, field, rule) => {
    const path = rawPath.includes(':id') ? rawPath.replace(':id', ((await h.call('POST', '/api/v1/products', { body: product({}) })).json.data as { id: string }).id) : rawPath;
    expect((await h.call('POST', path, { body: okBody })).status).toBe(201);
    const r = await h.call('POST', path, { body: badBody });
    expect(r.status).toBe(422);
    expect(r.json.details?.fields).toContainEqual(expect.objectContaining({ path: field, rule }));
  });
});

// Ronda 4 · D: the new inputs of spools (quantity, reference price, scale and empty-spool weight, chosen spools, purchases
// for the average). The exact limit passes and one more fails with the right rule; ids that are not ids never reach SQL.
describe('spool inputs of ronda 4 (limits and injection)', () => {
  const spool = (over: Record<string, unknown>) => ({ filament: { material: 'PLA', color: 'Límites' }, costCents: 30000, grams: 1000, purchasedOn: '2026-11-01', ...over });
  const fields = (r: Awaited<ReturnType<Harness['call']>>) => (r.json.details?.fields ?? []) as { path: string; rule: string }[];

  it('quantity 1–20 and a reference price up to $1,000,000 per kilo', async () => {
    const twenty = await h.call('POST', '/api/v1/spools', { body: spool({ quantity: 20 }) });
    expect(twenty.status).toBe(201);
    expect((twenty.json.data as { spools: unknown[] }).spools).toHaveLength(20);
    for (const [quantity, rule] of [[21, 'too_big'], [0, 'too_small']] as const) {
      const r = await h.call('POST', '/api/v1/spools', { body: spool({ quantity }) });
      expect(r.status).toBe(422);
      expect(fields(r)).toContainEqual(expect.objectContaining({ path: 'quantity', rule }));
    }
    const gift = (cents: number) => spool({ filament: { material: 'Nylon', color: `Ref ${cents}` }, costCents: 0, noCost: true, referenceCentsPerKg: cents });
    expect((await h.call('POST', '/api/v1/spools', { body: gift(100_000_000) })).status).toBe(201);
    const r = await h.call('POST', '/api/v1/spools', { body: gift(100_000_001) });
    expect(r.status).toBe(422);
    expect(fields(r)).toContainEqual(expect.objectContaining({ path: 'referenceCentsPerKg', rule: 'too_big' }));
  });

  it('weigh: empty-spool weight up to 10,000 g, scale up to 100,000 g with one decimal; out of the spool → WEIGHT_OUT_OF_RANGE', async () => {
    const id = ((await h.call('POST', '/api/v1/spools', { body: spool({ filament: { material: 'PLA', color: 'Báscula' } }) })).json.data as { spool: { id: string } }).spool.id;
    expect((await h.call('POST', `/api/v1/spools/${id}/weigh`, { body: { scaleGrams: 10_500, tareGrams: 10_000 } })).status).toBe(200);
    for (const [body, path, rule] of [
      [{ scaleGrams: 10_500, tareGrams: 10_001 }, 'tareGrams', 'too_big'],
      [{ scaleGrams: 100_000.1, tareGrams: 0 }, 'scaleGrams', 'too_big'],
      [{ scaleGrams: 500, tareGrams: 0, extra: "'; DROP TABLE spool; --" }, '', 'unrecognized_keys'],
    ] as const) {
      const r = await h.call('POST', `/api/v1/spools/${id}/weigh`, { body });
      expect(r.status).toBe(422);
      expect(r.json.code).toBe('VALIDATION_ERROR');
      if (rule !== 'unrecognized_keys') expect(fields(r)).toContainEqual(expect.objectContaining({ path, rule }));
    }
    const far = await h.call('POST', `/api/v1/spools/${id}/weigh`, { body: { scaleGrams: 100_000, tareGrams: 0 } });
    expect([far.status, far.json.code]).toEqual([422, 'WEIGHT_OUT_OF_RANGE']);
    // An id that is not an id is refused before any query; the spool is unchanged.
    for (const bad of ["1' OR '1'='1", '..%2F..%2Fetc', '00000000-0000-7000-8000-000000000000']) {
      const r = await h.call('POST', `/api/v1/spools/${bad}/finish`, { body: {} });
      expect([404, 422]).toContain(r.status);
    }
    expect((await h.call('POST', `/api/v1/spools/${id}/finish`, { body: { on: "2026-11-01'; --" } })).status).toBe(422);
  });

  it('chosen spools: up to 10 per filament, grams > 0 with one decimal, ids only', async () => {
    const out = (await h.call('POST', '/api/v1/spools', { body: spool({ filament: { material: 'PLA', color: 'Elegidos' }, quantity: 11 }) })).json.data as { filament: { id: string }; spools: { id: string }[] };
    const body = (spools: unknown[]) => ({ on: '2026-11-07', text: 'Prueba', qty: 1, result: 'ok', hours: 0, reason: 'test', filaments: [{ filamentId: out.filament.id, grams: 10, spools }] });
    expect((await h.call('POST', '/api/v1/print-runs', { body: body(out.spools.slice(0, 10).map((s) => ({ spoolId: s.id, grams: 1 }))) })).status).toBe(201);
    for (const spools of [
      out.spools.map((s) => ({ spoolId: s.id, grams: 1 })),
      [{ spoolId: out.spools[0]!.id, grams: 0 }],
      [{ spoolId: out.spools[0]!.id, grams: 1.25 }],
      [{ spoolId: "x' OR 1=1 --" }],
    ]) {
      const r = await h.call('POST', '/api/v1/print-runs', { body: body(spools) });
      expect(r.status).toBe(422);
      expect(r.json.code).toBe('VALIDATION_ERROR');
    }
  });

  it('purchases for the average: 1–10, whole numbers', async () => {
    expect((await h.call('PATCH', '/api/v1/settings', { body: { costAvgPurchases: 10 } })).status).toBe(200);
    for (const [v, rule] of [[11, 'too_big'], [0, 'too_small'], [2.5, 'invalid_type']] as const) {
      const r = await h.call('PATCH', '/api/v1/settings', { body: { costAvgPurchases: v } });
      expect(r.status).toBe(422);
      expect(fields(r).map((f) => f.path)).toContain('costAvgPurchases');
      if (rule !== 'invalid_type') expect(fields(r)).toContainEqual(expect.objectContaining({ path: 'costAvgPurchases', rule }));
    }
    expect((await h.call('PATCH', '/api/v1/settings', { body: { costAvgPurchases: 3 } })).status).toBe(200);
  });
});
