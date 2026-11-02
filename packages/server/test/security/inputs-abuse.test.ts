// docs/11 · A05 (injection strings are stored and returned as plain text) and A06 (abuse of business rules).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Catalogue, FilamentList, SupplyDetail } from '@app/contract';
import type { Database } from '@app/db';
import { listFilaments } from '../../src/queries/filaments';
import { appAs, ctxA, twoBusinesses } from './fixtures';

let database: Database;
let app: ReturnType<typeof appAs>['app'];
let filamentId: string;
beforeAll(async () => {
  database = await twoBusinesses();
  app = appAs(database, ctxA).app;
  filamentId = (await listFilaments(database.db, ctxA)).items[0]!.id;
});
afterAll(() => database.close());

const send = (method: string, url: string, body: unknown) => app.request(url, { method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
const ATTACKS = ["Robert'); DROP TABLE product;--", '<script>alert(1)</script>', '=HYPERLINK("http://evil","clic")', '"; DELETE FROM spool; --', '../../etc/passwd', '{{7*7}}${7*7}'];

describe('A05 · injection strings are just text', () => {
  it.each(ATTACKS)('product name %s round-trips unchanged and nothing breaks', async (attack) => {
    const r = await send('POST', '/api/v1/products', { name: attack, mode: 'value', priceCents: 1000, printMinutes: 5, filaments: [{ filamentId, grams: 1 }], note: attack, tags: [attack.slice(0, 40)] });
    expect(r.status).toBe(201);
    const cat = (await (await app.request('/api/v1/products')).json()) as Catalogue;
    expect(cat.products.find((p) => p.name === attack.trim().replace(/\s+/g, ' '))?.note).toBe(attack);
  });
  it('supplies, suppliers, channels and spools accept the same strings safely', async () => {
    for (const attack of ATTACKS) {
      expect((await send('POST', '/api/v1/suppliers', { name: attack, note: attack })).status).toBe(201);
      expect((await send('POST', '/api/v1/supplies', { name: `${attack} s`, costCents: 1, on: '2026-11-01', note: attack })).status).toBe(201);
      expect((await send('POST', '/api/v1/settings/channels', { name: `${attack} c` })).status).toBe(201);
      expect((await send('POST', '/api/v1/filaments/spools', { material: attack.slice(0, 60), color: 'Negro', costCents: 100, grams: 10, purchasedOn: '2026-11-01' })).status).toBe(201);
    }
    // The tables are all still there and readable.
    for (const path of ['/api/v1/products', '/api/v1/filaments', '/api/v1/supplies', '/api/v1/suppliers', '/api/v1/settings', '/api/v1/printers']) expect((await app.request(path)).status, path).toBe(200);
    const fl = (await (await app.request('/api/v1/filaments')).json()) as FilamentList;
    expect(fl.items.some((f) => f.material === "Robert'); DROP TABLE product;--")).toBe(true);
  });
});

describe('A06 · abuse of the rules is refused (422/409), nothing written', () => {
  it.each([
    ['negative cost', '/api/v1/filaments/spools', { material: 'PLA', color: 'X', costCents: -100, grams: 10, purchasedOn: '2026-11-01' }],
    ['zero grams', '/api/v1/filaments/spools', { material: 'PLA', color: 'X', costCents: 100, grams: 0, purchasedOn: '2026-11-01' }],
    ['absurd amount', '/api/v1/filaments/spools', { material: 'PLA', color: 'X', costCents: 1e13, grams: 10, purchasedOn: '2026-11-01' }],
    ['absurd grams', '/api/v1/filaments/spools', { material: 'PLA', color: 'X', costCents: 100, grams: 1e9, purchasedOn: '2026-11-01' }],
    ['fractional cents', '/api/v1/supplies', { name: 'Z', costCents: 1.5, on: '2026-11-01' }],
    ['impossible date', '/api/v1/filaments/spools', { material: 'PLA', color: 'X', costCents: 100, grams: 10, purchasedOn: '2026-13-45' }],
    ['huge quantity', '/api/v1/supplies', { name: 'Q', costCents: 1, initialQty: 1e12, on: '2026-11-01' }],
    ['too many lines', '/api/v1/products', { name: 'P', mode: 'value', priceCents: 1, printMinutes: 1, filaments: Array.from({ length: 21 }, () => ({ filamentId: '0190a000-0000-7000-8000-000000000999', grams: 1 })) }],
    ['name too long', '/api/v1/suppliers', { name: 'x'.repeat(500) }],
    ['wrong types', '/api/v1/printers', { name: 'P', costCents: '1000', kw: 'mucho' }],
    ['margin over 95 %', '/api/v1/settings', { formulaMarginPct: 120 }],
  ] as const)('%s → 422', async (_n, url, body) => {
    const r = await send(url === '/api/v1/settings' ? 'PATCH' : 'POST', url, body);
    expect(r.status).toBe(422);
    expect(await r.json()).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('cannot take more of a supply than there is, even by double submission', async () => {
    const s = (await (await send('POST', '/api/v1/supplies', { name: 'Doble', costCents: 10, initialQty: 5, on: '2026-11-01' })).json()) as SupplyDetail;
    const [a, b] = await Promise.all([send('POST', `/api/v1/supplies/${s.id}/movements`, { kind: 'use', qty: 4, on: '2026-11-01' }), send('POST', `/api/v1/supplies/${s.id}/movements`, { kind: 'use', qty: 4, on: '2026-11-01' })]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(((await (await app.request(`/api/v1/supplies/${s.id}`)).json()) as SupplyDetail).stock).toBe(1);
  });

  it('the client cannot set costs or sneak extra fields', async () => {
    const r = await send('POST', '/api/v1/products', { name: 'Intruso', mode: 'value', priceCents: 5000, printMinutes: 10, filaments: [{ filamentId, grams: 10 }], costing: { total: 0 }, workspaceId: '0190a000-0000-7000-8000-00000000000b', id: '0190a000-0000-7000-8000-000000000123' });
    const p = (await r.json()) as Catalogue['products'][number];
    expect(p.costing.total).toBeGreaterThan(0);
    expect(p.id).not.toBe('0190a000-0000-7000-8000-000000000123');
  });

  it('validation errors say which field, never echo the input', async () => {
    const r = await send('POST', '/api/v1/suppliers', { name: '<script>secret</script>'.repeat(10) });
    const text = await r.text();
    expect(text).not.toContain('<script>');
    expect(JSON.parse(text).details[0]).toEqual({ path: 'name', code: 'too_big' });
  });
});
