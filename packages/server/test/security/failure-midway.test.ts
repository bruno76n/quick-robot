// A failure halfway through any write use case leaves nothing written (docs/11 A10, docs/12 §11).
// WRITE_ROUTES must list every write route; a new one without a case here makes the test fail.
import { listFilaments, listSpools } from '@app/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Deps } from '../../src/deps';
import type { Ctx } from '@app/db';
import { addSpool } from '../../src/usecases/add-spool';
import { failOnWrite, makeHarness, validSpool, type Harness } from '../harness';

let h: Harness;
beforeAll(async () => { h = await makeHarness(); });
afterAll(() => h.close());

type Case = { run: (deps: Deps, ctx: Ctx) => Promise<unknown>; writes: number };
const WRITE_ROUTES: Record<string, Case> = {
  'POST /api/v1/spools': { run: (d, c) => addSpool(d, c, validSpool({ filament: { material: 'PLA', color: 'Midway' } })), writes: 3 },
};

async function snapshot(ctx: Ctx) {
  const f = await listFilaments(h.db, ctx, { page: 1, pageSize: 200 });
  return JSON.stringify([f, await listSpools(h.db, ctx, f.items.map((x) => x.id))]);
}

describe('failure midway', () => {
  it('every write route has a case', () => {
    const writes = h.app.routes.filter((r) => r.method !== 'GET').map((r) => `${r.method} ${r.path}`);
    expect(writes.filter((w) => !WRITE_ROUTES[w])).toEqual([]);
  });

  for (const [name, c] of Object.entries(WRITE_ROUTES)) {
    for (let n = 1; n <= c.writes; n++) {
      it(`${name}: failure on write #${n} → nothing written`, async () => {
        const before = await snapshot(h.A);
        await expect(c.run({ ...h.deps, db: failOnWrite(h.db, n) }, h.A)).rejects.toThrow(/injected/);
        expect(await snapshot(h.A)).toBe(before);
      });
    }
  }

  it('an unexpected error over HTTP → 500 with a generic message and errorId, never the trace', async () => {
    const broken = { ...h.deps, db: failOnWrite(h.db, 1) };
    const { createApp } = await import('../../src/app');
    const res = await createApp(broken).request('http://127.0.0.1/api/v1/spools', {
      method: 'POST', headers: { authorization: 'Bearer token-a', 'content-type': 'application/json' }, body: JSON.stringify(validSpool()),
    });
    expect(res.status).toBe(500);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json).toMatchObject({ code: 'INTERNAL_ERROR', message: 'Unexpected error' });
    expect(json.errorId).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(json)).not.toMatch(/injected|at |\.ts/);
    expect(h.logger.records().some((r) => r.msg === 'unexpected error' && r.errorId === json.errorId)).toBe(true);
  });
});
