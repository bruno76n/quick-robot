// Security headers on the API and on pages (docs/11 A02).
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { makeHarness, type Harness } from '../harness';

let h: Harness;
beforeAll(async () => { h = await makeHarness(); });
afterAll(() => h.close());

const expectHardened = (headers: Headers) => {
  expect(headers.get('content-security-policy')).toMatch(/default-src 'self'.*script-src 'self'.*frame-ancestors 'none'/);
  expect(headers.get('content-security-policy')).not.toMatch(/script-src[^;]*unsafe/);
  expect(headers.get('x-content-type-options')).toBe('nosniff');
  expect(headers.get('x-frame-options')).toBe('DENY');
  expect(headers.get('referrer-policy')).toBe('no-referrer');
  expect(headers.get('permissions-policy')).toContain('camera=()');
  expect(headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
  expect(headers.get('x-powered-by')).toBeNull();
  expect(headers.get('access-control-allow-origin')).toBeNull();
};

describe('headers', () => {
  it('API responses are hardened and not cached', async () => {
    for (const path of ['/api/v1/filaments', '/api/v1/health', '/api/v1/nope']) {
      const r = await h.call('GET', path);
      expectHardened(r.headers);
      expect(r.headers.get('cache-control')).toBe('no-store');
    }
  });

  it('errors are hardened too', async () => {
    expectHardened((await h.call('GET', '/api/v1/filaments', { token: null })).headers);
  });

  it('pages served from the web build are hardened, with SPA fallback and no path escape', async () => {
    const root = mkdtempSync(join(tmpdir(), 'web-'));
    writeFileSync(join(root, 'index.html'), '<!doctype html><title>x</title>');
    const app = createApp(h.deps, { webRoot: root });
    const page = await app.request('http://127.0.0.1/filamentos');
    expect(page.status).toBe(200);
    expectHardened(page.headers);
    expect(page.headers.get('content-type')).toContain('text/html');
    expect((await app.request('http://127.0.0.1/../../etc/passwd')).status).not.toBe(500);
    expect(await (await app.request('http://127.0.0.1/%2e%2e/%2e%2e/etc/passwd')).text()).not.toContain('root:');
    expect((await app.request('http://127.0.0.1/missing.js')).status).toBe(404);
  });

  it('HSTS only when the cloud root asks for it', async () => {
    expect((await h.call('GET', '/api/v1/health')).headers.get('strict-transport-security')).toBeNull();
    const app = createApp({ ...h.deps, hsts: true });
    expect((await app.request('http://127.0.0.1/api/v1/health')).headers.get('strict-transport-security')).toContain('max-age=');
  });
});
