// Integration: "add spool → it appears in the list" through HTTP, with contract validation of the responses.
import { addSpoolOutput, filamentDetail, filamentListItem, page } from '@app/contract';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeHarness, validSpool, type Harness } from '../harness';

let h: Harness;
beforeAll(async () => { h = await makeHarness(); });
afterAll(() => h.close());

describe('filament routes', () => {
  it('add spool → appears in the list and in the detail', async () => {
    const created = await h.call('POST', '/api/v1/spools', { body: validSpool() });
    expect(created.status).toBe(201);
    const out = addSpoolOutput.parse(created.json.data);
    const list = await h.call('GET', '/api/v1/filaments');
    expect(list.status).toBe(200);
    const p = page(filamentListItem).parse(list.json.data);
    expect(p.items.map((f) => f.id)).toEqual([out.filament.id]);
    expect(p).toMatchObject({ page: 1, pageSize: 50, total: 1 });
    const detail = await h.call('GET', `/api/v1/filaments/${out.filament.id}`);
    const d = filamentDetail.parse(detail.json.data);
    expect(d.spools[0]?.status).toBe('new');
    expect(d.movements[0]?.kind).toBe('purchase');
  });

  it('invalid input → 422 VALIDATION_ERROR with fields', async () => {
    const r = await h.call('POST', '/api/v1/spools', { body: validSpool({ filament: undefined, costCents: -1 }) });
    expect(r.status).toBe(422);
    expect(r.json.code).toBe('VALIDATION_ERROR');
    expect(r.json.details?.fields).toEqual(expect.arrayContaining([{ path: 'filament', rule: 'required' }, { path: 'costCents', rule: 'too_small', params: { min: 0 } }]));
  });

  it('search and pagination', async () => {
    await h.call('POST', '/api/v1/spools', { body: validSpool({ filament: { material: 'PETG', color: 'Verde' } }) });
    expect((await h.call('GET', '/api/v1/filaments?q=petg')).json.data).toMatchObject({ total: 1 });
    expect((await h.call('GET', '/api/v1/filaments?pageSize=1&page=2')).json.data).toMatchObject({ page: 2, total: 2 });
    expect((await h.call('GET', '/api/v1/filaments?pageSize=500')).status).toBe(422);
  });

  it('GET /me and /health', async () => {
    expect((await h.call('GET', '/api/v1/me')).json.data).toMatchObject({ workspace: { name: 'Negocio A' }, role: 'owner' });
    const health = await h.call('GET', '/api/v1/health', { token: null });
    expect(health.json.data).toMatchObject({ ok: true, version: 'test', schemaVersion: 4 });
  });
});
