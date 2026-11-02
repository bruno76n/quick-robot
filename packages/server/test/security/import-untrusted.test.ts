// Anything that comes in is untrusted (docs/11 A06, A08): malformed bodies, oversized bodies, writes from
// other sites, wrong content types, extra fields, prototype pollution, and unsafe startup configuration.
// Importing backup files (phase 4) adds its cases here.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadLocalConfig } from '../../src/config';
import { makeHarness, validSpool, type Harness } from '../harness';

let h: Harness;
beforeAll(async () => { h = await makeHarness(); });
afterAll(() => h.close());

describe('untrusted input', () => {
  it('malformed JSON → 422, nothing written', async () => {
    const r = await h.call('POST', '/api/v1/spools', { body: '{"filament":' });
    expect(r.status).toBe(422);
    expect(r.json.code).toBe('VALIDATION_ERROR');
  });

  it('bodies over 1 MB → 413 PAYLOAD_TOO_LARGE', async () => {
    const r = await h.call('POST', '/api/v1/spools', { body: validSpool({ note: 'x'.repeat(1_100_000) }) });
    expect(r.status).toBe(413);
    expect(r.json).toMatchObject({ code: 'PAYLOAD_TOO_LARGE', details: { maxBytes: 1_048_576 } });
  });

  it('writes from another site are rejected (local server on 127.0.0.1)', async () => {
    for (const headers of [{ origin: 'https://evil.example' }, { 'sec-fetch-site': 'cross-site' }]) {
      const r = await h.call('POST', '/api/v1/spools', { body: validSpool(), headers });
      expect(r.status).toBe(403);
    }
    expect((await h.call('POST', '/api/v1/spools', { body: validSpool(), headers: { origin: 'http://127.0.0.1' } })).status).toBe(201);
  });

  it('non-JSON writes (form posts, text/plain) are rejected', async () => {
    for (const type of ['text/plain', 'application/x-www-form-urlencoded']) {
      const r = await h.call('POST', '/api/v1/spools', { body: JSON.stringify(validSpool()), headers: { 'content-type': type } });
      expect(r.status).toBe(422);
    }
  });

  it('extra fields and prototype pollution are ignored', async () => {
    const r = await h.call('POST', '/api/v1/spools', { body: '{"__proto__":{"admin":true},"constructor":{"prototype":{"x":1}},"workspaceId":"00000000-0000-7000-8000-000000000999","costPerGram":99,' + JSON.stringify(validSpool({ filament: { material: 'ABS', color: 'Gris' } })).slice(1) });
    expect(r.status).toBe(201);
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
    expect((r.json.data as { filament: { costPerGram: number } }).filament.costPerGram).toBe(0.5);
  });

  it('the server ignores costs sent by the client: it recalculates', async () => {
    const r = await h.call('POST', '/api/v1/spools', { body: { ...validSpool({ filament: { material: 'TPU', color: 'Negro' } }), remainingGrams: 99999, status: 'out' } });
    expect((r.json.data as { filament: { remainingGrams: number; status: string } }).filament).toMatchObject({ remainingGrams: 1000, status: 'new' });
  });
});

describe('startup configuration', () => {
  it('a valid local config starts', () => {
    expect(loadLocalConfig({ port: 0, secret: 'a'.repeat(43) })).toMatchObject({ host: '127.0.0.1', port: 0 });
  });
  it.each([
    [{ host: '0.0.0.0' }],
    [{ secret: 'short' }],
    [{ port: 70000 }],
    [{ allowedOrigins: ['not a url'] }],
  ])('an unsafe or incomplete config does not start: %j', (cfg) => {
    expect(() => loadLocalConfig(cfg)).toThrow(/Invalid configuration/);
  });
});
