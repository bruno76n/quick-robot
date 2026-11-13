// Export, import (own format and mockup v7), automatic backups, restore and "Vaciar negocio" (docs/12 §10, docs/05).
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyDevelopmentSeed } from '../../src/dev-seed';
import { ensureDailyBackup, exportData } from '../../src/usecases/workspace-data';
import { listProducts } from '@app/db';
import { B_TOKEN, makeHarness, type Harness } from '../harness';

const MOCKUP = readFileSync(new URL('../../../../reference/mockup-backup-v7.json', import.meta.url));
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
let h: Harness;
beforeAll(async () => { h = await makeHarness(); await applyDevelopmentSeed(h.deps, h.A); }, 60_000);
afterAll(() => h.close());
type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const get = async (p: string, token?: string) => (await h.call('GET', `/api/v1${p}`, token ? { token } : {})).json as J;
const upload = async (bytes: Uint8Array | string, opts: { confirm?: boolean; token?: string } = {}) => {
  const fd = new FormData();
  fd.set('file', new Blob([bytes as unknown as ArrayBuffer], { type: 'application/json' }), 'copia.json');
  if (opts.confirm !== false) fd.set('confirm', 'true');
  const res = await h.app.request('http://127.0.0.1/api/v1/workspace/import', { method: 'POST', headers: { authorization: `Bearer ${opts.token ?? B_TOKEN}` }, body: fd });
  return { status: res.status, json: (await res.json()) as J };
};
const summary = async (token?: string) => {
  const r = (await get('/reports?period=all', token)).data;
  const s = (await get('/stock', token)).data;
  const f = (await get('/filaments?pageSize=200', token)).data;
  return { income: r.totals.incomeCents, profit: r.totals.profitCents, stock: s.items.map((x: J) => `${x.name}:${x.physical}`).sort(), grams: f.items.map((x: J) => `${x.material} ${x.color}:${x.remainingGrams}`).sort() };
};

describe('export and import of the own format', () => {
  it('A exported and imported into B gives the same business (counts, sums, files)', async () => {
    const fd = new FormData();
    fd.set('kind', 'customer_logo');
    fd.set('file', new Blob([Buffer.from(PNG, 'base64')], { type: 'image/png' }), 'l.png');
    const up = (await (await h.app.request('http://127.0.0.1/api/v1/files', { method: 'POST', headers: { authorization: 'Bearer token-a' }, body: fd })).json()) as J;
    const res = await h.app.request('http://127.0.0.1/api/v1/workspace/export', { headers: { authorization: 'Bearer token-a' } });
    expect(res.headers.get('content-disposition')).toMatch(/attachment; filename=".+-2026-11-01\.json"/);
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect((await get('/settings')).data.settings.lastBackupOn).toBe('2026-11-01');
    const r = await upload(bytes);
    expect(r.status).toBe(200);
    expect(r.json.data.format).toBe('workspace');
    expect(r.json.data.counts.sale).toBe(25);
    expect(await summary(B_TOKEN)).toEqual(await summary());
    expect(up.data.fileId).toBeTruthy();
    // Ids are new in B (the same database already has A's), but the bytes of every file came along.
    expect(Object.values((await exportData(h.deps, h.B)).files).sort()).toEqual(Object.values((await exportData(h.deps, h.A)).files).sort());
    expect(r.json.data.backupId).toBe('2026-11-01');
  });

  it('errors: confirmation, garbage, unknown table or column, wrong types, newer version, mockup v6, too large; nothing changes', async () => {
    const before = await summary(B_TOKEN);
    const good = JSON.parse(new TextDecoder().decode(new TextEncoder().encode(JSON.stringify(await exportData(h.deps, h.A))))) as J;
    expect((await upload(JSON.stringify(good), { confirm: false })).json.code).toBe('CONFIRMATION_REQUIRED');
    expect((await upload('no es json')).json).toMatchObject({ code: 'IMPORT_INVALID_FILE' });
    expect((await upload(JSON.stringify({ ...good, tables: { ...good.tables, hacker: [] } }))).json.details.reason).toBe('table:hacker');
    expect((await upload(JSON.stringify({ ...good, tables: { ...good.tables, sale: [{ ...good.tables.sale[0], evil: 1 }] } }))).json.details.reason).toBe('column:sale.evil');
    expect((await upload(JSON.stringify({ ...good, tables: { ...good.tables, sale: [{ ...good.tables.sale[0], on: 5 }] } }))).json.details.reason).toBe('type:sale.on#0');
    expect((await upload(JSON.stringify({ ...good, tables: { ...good.tables, sale: [{ ...good.tables.sale[0], id: 'x' }] } }))).json.details.reason).toBe('id:sale#0');
    expect((await upload(JSON.stringify({ ...good, schemaVersion: 999 }))).json).toMatchObject({ code: 'IMPORT_UNSUPPORTED_VERSION', details: { found: '999' } });
    expect((await upload(JSON.stringify({ v: 6 }))).json).toMatchObject({ code: 'IMPORT_UNSUPPORTED_VERSION', details: { found: 'v6', supported: 'v7' } });
    expect((await upload(JSON.stringify({ v: 7, config: 1 }))).json.details.reason).toBe('mockup-shape');
    // A row that breaks a constraint in the middle rolls everything back.
    const broken = { ...good, tables: { ...good.tables, line_item: [...good.tables.line_item, { ...good.tables.line_item[0], id: good.tables.sale[0].id, parentKind: 'x' }] } };
    expect((await upload(JSON.stringify(broken))).status).toBe(500);
    expect(await summary(B_TOKEN)).toEqual(before);
    const big = await makeHarness({ importLimitMb: 0.001 });
    try {
      const fd = new FormData(); fd.set('file', new Blob(['x'.repeat(5000)]), 'c.json'); fd.set('confirm', 'true');
      expect(((await (await big.app.request('http://127.0.0.1/api/v1/workspace/import', { method: 'POST', headers: { authorization: 'Bearer token-a' }, body: fd })).json()) as J).code).toBe('FILE_TOO_LARGE');
    } finally { await big.close(); }
  });
});

describe('old backups with variants (informe-ronda2-a §4.3): normalized like migration 0007', () => {
  it('no variant_label, a chain, an orphan and a hostile label → root, independent piece, labels; names unchanged', async () => {
    const good = JSON.parse(JSON.stringify(await exportData(h.deps, h.A))) as J;
    const rows = good.tables.product as J[];
    const root = rows.find((p) => p.name === 'Spider-Man · salto')!;
    const silk = rows.find((p) => p.name === 'Spider-Man · salto (silk morado)')!;
    const id = (n: number) => `0190ffff-0000-7000-8000-${n.toString(16).padStart(12, '0')}`;
    const copy = (over: J) => ({ ...root, ...over });
    rows.push(
      copy({ id: id(1), name: 'Spider-Man · salto (silk morado) (variante)', parentId: silk.id }), // chain → root
      copy({ id: id(2), name: 'Maceta borrada', parentId: null, deletedAt: '2026-10-01T00:00:00.000Z' }),
      copy({ id: id(3), name: 'Maceta borrada (variante)', parentId: id(2) }), // orphan → independent
      copy({ id: id(4), name: 'Spider-Man · salto · dorado', parentId: root.id, variantLabel: ` ${'<script>'.repeat(20)} ` }), // too long → cut to 60
    );
    for (const p of rows) if (p.id !== id(4)) delete p.variantLabel;
    const r = await upload(JSON.stringify(good));
    expect(r.status).toBe(200);
    const all = await listProducts(h.deps.db, h.B, { withDeleted: true });
    const by = (n: string) => all.find((p) => p.name === n)!;
    expect([by('Spider-Man · salto (silk morado)').parentId, by('Spider-Man · salto (silk morado)').variantLabel]).toEqual([by('Spider-Man · salto').id, 'silk morado']);
    expect([by('Spider-Man · salto (silk morado) (variante)').parentId, by('Spider-Man · salto (silk morado) (variante)').variantLabel]).toEqual([by('Spider-Man · salto').id, 'silk morado']);
    expect([by('Maceta borrada (variante)').parentId, by('Maceta borrada (variante)').variantLabel]).toEqual([null, null]);
    expect(by('Spider-Man · salto · dorado').variantLabel).toBe('<script>'.repeat(20).slice(0, 60));
    expect(all.map((p) => p.name).sort()).toEqual(rows.map((p) => p.name).sort());
  });
});

describe('import of the mockup v7 backup', () => {
  it('no differences in spools, stock, sales and owed; same numbers as the seed', async () => {
    const r = await upload(MOCKUP);
    expect(r.status).toBe(200);
    expect(r.json.data).toMatchObject({ format: 'mockup-v7', differences: [], notes: [] });
    expect(r.json.data.counts).toMatchObject({ sale: 25, order: 7, customer: 4, spool: 8, print_run: b().imps.length, expense: 5 });
    expect(await summary(B_TOKEN)).toEqual(await summary());
  });
  it('logos as data URL go to the file store; a missing channel is created; an order without customer gets "Sin nombre"', async () => {
    const m = b();
    m.clientes[0].logoImg = `data:image/png;base64,${PNG}`;
    m.clientes[1].logoImg = 'data:text/html;base64,PHNjcmlwdD4=';
    m.ventas[0].canal = 'Tianguis';
    m.pedidos[0].cliente = 'no-existe';
    const r = await upload(JSON.stringify(m));
    expect(r.json.data.notes).toEqual(expect.arrayContaining(['channel:Tianguis', 'customer:Sin nombre', 'image:customer_logo']));
    const customers = (await get('/customers', B_TOKEN)).data as J[];
    expect(customers.find((c) => c.name === m.clientes[0].nombre)!.logoFileId).toBeTruthy();
    expect(customers.some((c) => c.name === 'Sin nombre')).toBe(true);
    expect((await get('/settings', B_TOKEN)).data.channels.some((c: J) => c.name === 'Tianguis' && c.commissionPct === 0)).toBe(true);
  });
});

describe('backups, restore and clear', () => {
  it('a daily backup once per day; restore puts it back; clear leaves an empty business with a backup', async () => {
    expect((await get('/backups', B_TOKEN)).data.map((x: J) => x.id)).toEqual(['2026-11-01']);
    expect(await ensureDailyBackup(h.deps, h.B)).toBeNull();
    expect((await h.call('POST', '/api/v1/workspace/clear', { token: B_TOKEN, body: {} })).json.code).toBe('CONFIRMATION_REQUIRED');
    await h.call('POST', '/api/v1/backups', { token: B_TOKEN });
    const before = await summary(B_TOKEN);
    const cleared = await h.call('POST', '/api/v1/workspace/clear', { token: B_TOKEN, body: { confirm: true } });
    expect((cleared.json as J).data.backupId).toBe('2026-11-01');
    expect((await get('/sales', B_TOKEN)).data.total).toBe(0);
    expect((await get('/settings', B_TOKEN)).data.channels.length).toBeGreaterThan(0);
    expect((await h.call('POST', '/api/v1/backups/2026-11-01/restore', { token: B_TOKEN, body: {} })).json.code).toBe('CONFIRMATION_REQUIRED');
    expect((await h.call('POST', '/api/v1/backups/../../etc/restore', { token: B_TOKEN, body: { confirm: true } })).status).toBe(404);
    expect((await h.call('POST', '/api/v1/backups/2020-01-01/restore', { token: B_TOKEN, body: { confirm: true } })).status).toBe(404);
    const restored = await h.call('POST', '/api/v1/backups/2026-11-01/restore', { token: B_TOKEN, body: { confirm: true } });
    expect(restored.status).toBe(200);
    expect(await summary(B_TOKEN)).toEqual(before);
  });
});

function b(): J { return JSON.parse(MOCKUP.toString('utf8')); }
