// docs/11 · A01 (deny by default), A02 (headers), A05/A06 (content type, sizes, rate), A10 (bad ids → 404).
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '@app/db';
import { can, ACTIONS } from '../../src/authz';
import { listCatalogue } from '../../src/queries/catalogue';
import { appAs, ctxA, PNG, twoBusinesses } from './fixtures';

let database: Database;
beforeAll(async () => {
  database = await twoBusinesses();
});
afterAll(() => database.close());

const json = (method: string, body: unknown, headers: Record<string, string> = {}) => ({ method, body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...headers } });

describe('A01 · authorization: every route is guarded, deny by default', () => {
  it('a session with an unknown role gets 403 on every API route (except health)', async () => {
    const { app } = appAs(database, ctxA, 'nobody' as never);
    const routes = app.routes.filter((r) => r.path.startsWith('/api/v1/') && r.method !== 'ALL' && r.path !== '/api/v1/health');
    expect(routes.length).toBeGreaterThan(40);
    const id = '0190a000-0000-7000-8000-000000000999';
    for (const r of routes) {
      const url = r.path.replace(/:\w+/g, id);
      const init = ['GET', 'DELETE'].includes(r.method) ? { method: r.method } : r.path === '/api/v1/files' ? { method: 'POST', body: PNG, headers: { 'content-type': 'image/png' } } : json(r.method, {});
      const res = await app.request(url, init);
      expect(res.status, `${r.method} ${r.path}`).toBe(403);
    }
  });
  it('operator works the workshop but cannot change settings, prices or delete', async () => {
    expect(can({ role: 'operator' }, 'filaments.write')).toBe(true);
    expect(can({ role: 'operator' }, 'supplies.write')).toBe(true);
    for (const a of ['settings.write', 'products.write', 'products.delete', 'printers.delete', 'filaments.delete'] as const) expect(can({ role: 'operator' }, a)).toBe(false);
    for (const a of ACTIONS) expect(can({ role: 'owner' }, a)).toBe(true);
    const { app } = appAs(database, ctxA, 'operator');
    expect((await app.request('/api/v1/settings', json('PATCH', { purgePct: 1 }))).status).toBe(403);
    expect((await app.request('/api/v1/products')).status).toBe(200);
  });
  it('without a session: 401 (fail closed)', async () => {
    const { app } = appAs(database, ctxA);
    const deps = { auth: { resolve: async () => null } };
    const closed = appAs(database, ctxA, 'owner', deps).app;
    expect((await closed.request('/api/v1/products')).status).toBe(401);
    expect((await app.request('/api/v1/products')).status).toBe(200);
  });
});

describe('A02 · security headers', () => {
  it('API and static pages carry CSP, nosniff, frame and referrer policies; no HSTS locally', async () => {
    const dist = mkdtempSync(join(tmpdir(), 'web-dist-'));
    writeFileSync(join(dist, 'index.html'), '<!doctype html><title>x</title>');
    const { app } = appAs(database, ctxA, 'owner', { webDist: dist });
    for (const path of ['/api/v1/health', '/api/v1/products', '/filamentos']) {
      const r = await app.request(path);
      expect(r.headers.get('content-security-policy'), path).toContain("frame-ancestors 'none'");
      expect(r.headers.get('content-security-policy'), path).toContain("script-src 'self'");
      expect(r.headers.get('x-content-type-options')).toBe('nosniff');
      expect(r.headers.get('referrer-policy')).toBe('no-referrer');
      expect(r.headers.get('x-frame-options')).toBe('DENY');
      expect(r.headers.get('strict-transport-security')).toBeNull();
    }
    expect((await app.request('/api/v1/products')).headers.get('cache-control')).toBe('no-store');
  });
  it('HSTS when the deployment asks for it (cloud, HTTPS)', async () => {
    const { app } = appAs(database, ctxA, 'owner', { security: { hsts: true } });
    expect((await app.request('/api/v1/health')).headers.get('strict-transport-security')).toContain('max-age=');
  });
  it('health says nothing about the deployment', async () => {
    const { app } = appAs(database, ctxA);
    expect(await (await app.request('/api/v1/health')).json()).toEqual({ ok: true });
  });
});

describe('cross-site writes, content types, sizes and rates', () => {
  it('a write from another site is refused (Origin / Sec-Fetch-Site)', async () => {
    const { app } = appAs(database, ctxA);
    expect((await app.request('http://127.0.0.1:8787/api/v1/suppliers', json('POST', { name: 'X' }, { origin: 'https://evil.example' }))).status).toBe(403);
    expect((await app.request('http://127.0.0.1:8787/api/v1/suppliers', json('POST', { name: 'X' }, { 'sec-fetch-site': 'cross-site' }))).status).toBe(403);
    expect((await app.request('http://127.0.0.1:8787/api/v1/suppliers', json('POST', { name: 'Mismo origen' }, { origin: 'http://127.0.0.1:8787', 'sec-fetch-site': 'same-origin' }))).status).toBe(201);
  });
  it('bodies must be JSON (a form post from a page cannot be accepted)', async () => {
    const { app } = appAs(database, ctxA);
    const r = await app.request('/api/v1/suppliers', { method: 'POST', body: '{"name":"X"}', headers: { 'content-type': 'text/plain' } });
    expect(r.status).toBe(415);
  });
  it('JSON bodies over 64 KB → 413', async () => {
    const { app } = appAs(database, ctxA);
    const r = await app.request('/api/v1/suppliers', json('POST', { name: 'X', note: 'a'.repeat(70_000) }));
    expect(r.status).toBe(413);
  });
  it('too many writes in a minute → 429', async () => {
    const { app } = appAs(database, ctxA, 'owner', { security: { writesPerMinute: 3 } });
    const codes = [];
    for (let i = 0; i < 5; i++) codes.push((await app.request('/api/v1/suppliers', json('POST', { name: `P${i}` }))).status);
    expect(codes).toEqual([201, 201, 201, 429, 429]);
  });
  it('an id that is not a UUID is "not found", never a database error', async () => {
    const { app } = appAs(database, ctxA);
    for (const path of ["/api/v1/products/1' OR '1'='1", '/api/v1/filaments/..%2F..%2Fetc', '/api/v1/files/abc']) expect((await app.request(path)).status, path).toBe(404);
  });
});

describe('uploads', () => {
  it('only real images: HTML declared as PNG is refused; real PNG accepted; > 2 MB refused', async () => {
    const { app } = appAs(database, ctxA);
    const fake = new TextEncoder().encode('<html><script>alert(1)</script></html>');
    expect((await app.request('/api/v1/files', { method: 'POST', body: fake, headers: { 'content-type': 'image/png' } })).status).toBe(415);
    expect((await app.request('/api/v1/files', { method: 'POST', body: new TextEncoder().encode('<svg/>'), headers: { 'content-type': 'image/svg+xml' } })).status).toBe(415);
    const ok = await app.request('/api/v1/files', { method: 'POST', body: PNG, headers: { 'content-type': 'image/png' } });
    expect(ok.status).toBe(201);
    const served = await app.request(`/api/v1/files/${((await ok.json()) as { id: string }).id}`);
    expect(served.headers.get('content-security-policy')).toContain('sandbox');
    const big = new Uint8Array(2 * 1024 * 1024 + 10);
    big.set(PNG);
    expect((await app.request('/api/v1/files', { method: 'POST', body: big, headers: { 'content-type': 'image/png' } })).status).toBe(413);
  });
  it('a product cannot point to a photo of another business', async () => {
    const { app } = appAs(database, ctxA);
    const p = (await listCatalogue(database.db, ctxA)).products[0]!;
    const r = await app.request(`/api/v1/products/${p.id}`, json('PUT', { name: p.name, mode: p.mode, priceCents: p.priceCents, printMinutes: p.printMinutes, filaments: p.filaments, photoFileId: '0190a000-0000-7000-8000-000000000999' }));
    expect(r.status).toBe(404);
  });
});
