// What is logged and what never is (docs/11 A09, docs/15 §6).
import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLogger, redact } from '../../src/logger';
import { localAuth } from '../../src/providers/local/auth';
import { rotatingFileSink } from '../../src/providers/local/log-file';
import { makeHarness, validSpool, type Harness } from '../harness';

let h: Harness;
beforeAll(async () => { h = await makeHarness(); });
afterAll(() => h.close());

describe('logging', () => {
  it('every request is logged with requestId, workspace, action, status and duration', async () => {
    await h.call('POST', '/api/v1/spools', { body: validSpool() });
    const rec = h.logger.records().find((r) => r.msg === 'request' && r.action === 'spool.create');
    expect(rec).toMatchObject({ workspaceId: h.A.workspaceId, status: 201, method: 'POST' });
    expect(rec?.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(typeof rec?.ms).toBe('number');
  });

  it('denied access leaves a record', async () => {
    await h.call('GET', '/api/v1/filaments', { token: 'token-nobody' });
    await h.call('GET', '/api/v1/filaments', { token: 'wrong' });
    const denied = h.logger.records().filter((r) => r.msg === 'access denied');
    expect(denied.map((r) => r.code ?? r.action)).toEqual(expect.arrayContaining(['filament.read', 'UNAUTHENTICATED']));
  });

  it('passwords, secrets, tokens, authorization and notes are redacted', () => {
    const lines: string[] = [];
    const log = createLogger((l) => lines.push(l));
    log.info('x', { password: 'hunter2', secret: 's3', authorization: 'Bearer abc', nested: { token: 't', note: 'cliente debe' }, msg2: 'Bearer zzz' });
    const text = lines.join('\n');
    for (const s of ['hunter2', 's3', 'abc', '"t"', 'cliente debe', 'zzz']) expect(text).not.toContain(s);
    expect(redact({ deep: { deeper: { password: 'p' } } })).toEqual({ deep: { deeper: { password: '[redacted]' } } });
  });

  it('the launch secret is never logged', async () => {
    const secret = 'S'.repeat(43);
    const auth = localAuth({ secret });
    expect(await auth.resolve(new Request('http://127.0.0.1/', { headers: { authorization: `Bearer ${secret}` } }))).not.toBeNull();
    expect(await auth.resolve(new Request('http://127.0.0.1/', { headers: { authorization: 'Bearer nope' } }))).toBeNull();
    expect(await auth.resolve(new Request('http://127.0.0.1/'))).toBeNull();
    expect(h.logger.lines.join('\n')).not.toContain(secret);
  });

  it('local log files rotate: 7 files of up to the limit, user-only permissions', () => {
    const dir = mkdtempSync(join(tmpdir(), 'logs-'));
    const sink = rotatingFileSink(dir, { maxBytes: 200, files: 3 });
    for (let i = 0; i < 40; i++) sink(JSON.stringify({ i, pad: 'x'.repeat(40) }));
    const files = readdirSync(dir).sort();
    expect(files).toEqual(['app.1.log', 'app.2.log', 'app.log']);
    expect(statSync(join(dir, 'app.log')).mode & 0o077).toBe(0);
    expect(readFileSync(join(dir, 'app.log'), 'utf8').length).toBeLessThanOrEqual(260);
  });
});
