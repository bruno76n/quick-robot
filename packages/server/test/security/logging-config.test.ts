// docs/11 · A09 (what is logged, what never is) and A02 (configuration validated at start).
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { productRepo, type Database } from '@app/db';
import { parseLocalConfig } from '../../src/config';
import { REDACTED, redact } from '../../src/logging';
import { createLocalAuth, newLaunchSecret } from '../../src/providers/local/auth';
import { createFileLogger } from '../../src/providers/local/log-file';
import { appAs, ctxA, twoBusinesses } from './fixtures';

let database: Database;
beforeAll(async () => {
  database = await twoBusinesses();
});
afterAll(() => database.close());

describe('A09 · logging', () => {
  it('every API request leaves a structured line; denied access and deletions are warnings', async () => {
    const { app, logger } = appAs(database, ctxA, 'operator');
    await app.request('/api/v1/products');
    await app.request('/api/v1/settings', { method: 'PATCH', body: '{"purgePct":1}', headers: { 'content-type': 'application/json' } });
    const [read, denied] = logger.entries();
    expect(read).toMatchObject({ level: 'info', method: 'GET', route: '/api/v1/products', action: 'products.read', status: 200, workspaceId: ctxA.workspaceId });
    expect(typeof read!.ms).toBe('number');
    expect(typeof read!.requestId).toBe('string');
    expect(denied).toMatchObject({ level: 'warn', msg: 'access denied', status: 403, action: 'settings.write' });
  });

  it('the launch secret, tokens and passwords never reach the log', async () => {
    const secret = newLaunchSecret();
    const { app, logger } = appAs(database, ctxA, 'owner', { auth: createLocalAuth({ ...ctxA, secret }) });
    expect((await app.request('/api/v1/products', { headers: { 'x-app-secret': 'wrong' } })).status).toBe(401);
    expect((await app.request('/api/v1/products', { headers: { 'x-app-secret': secret } })).status).toBe(200);
    expect(logger.lines.join('\n')).not.toContain(secret);
    expect(logger.entries()[0]).toMatchObject({ level: 'warn', status: 401 });
    expect(redact({ password: 'x', nested: { apiKey: 'k', token: 't', ok: 1 }, authorization: 'Bearer z' })).toEqual({ password: REDACTED, nested: { apiKey: REDACTED, token: REDACTED, ok: 1 }, authorization: REDACTED });
  });

  it('an unexpected error answers a generic message with an id (no stack) and logs the details', async () => {
    vi.spyOn(productRepo, 'list').mockRejectedValueOnce(new Error('relation "secret_table" does not exist at line 42'));
    const { app, logger } = appAs(database, ctxA);
    const r = await app.request('/api/v1/products');
    const body = (await r.json()) as { code: string; message: string; details: { errorId: string } };
    expect(r.status).toBe(500);
    expect(body.code).toBe('INTERNAL');
    expect(JSON.stringify(body)).not.toContain('secret_table');
    const err = logger.entries().find((e) => e.msg === 'unexpected error')!;
    expect(err.requestId).toBe(body.details.errorId);
    expect(String(err.error)).toContain('secret_table');
  });

  it('the local log file rotates by size and is private', () => {
    const dir = mkdtempSync(join(tmpdir(), 'logs-'));
    const log = createFileLogger(dir, { maxBytes: 300, keep: 2 });
    for (let i = 0; i < 30; i++) log.log({ level: 'info', msg: `line ${i}`, password: 'nope' });
    const files = readdirSync(dir).sort();
    expect(files).toEqual(['app.1.log', 'app.2.log', 'app.log']);
    expect(readFileSync(join(dir, 'app.log'), 'utf8')).not.toContain('nope');
  });
});

describe('A02 · configuration is validated at start', () => {
  it('safe defaults', () => {
    expect(parseLocalConfig({})).toMatchObject({ PORT: 8787, HOST: '127.0.0.1', SEED: 'quick-robot' });
  });
  it.each([
    [{ HOST: '0.0.0.0' }, 'HOST'],
    [{ PORT: 'abc' }, 'PORT'],
    [{ PORT: '70000' }, 'PORT'],
    [{ SEED: 'prod' }, 'SEED'],
    [{ APP_SECRET: 'short' }, 'APP_SECRET'],
  ])('refuses %o', (env, field) => {
    expect(() => parseLocalConfig(env)).toThrow(field);
  });
  it('launch secrets are 256 random bits', () => {
    const a = newLaunchSecret();
    expect(Buffer.from(a, 'base64url')).toHaveLength(32);
    expect(newLaunchSecret()).not.toBe(a);
  });
});
