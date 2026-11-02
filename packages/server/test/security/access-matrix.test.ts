// Access matrix (docs/12 §11, docs/11 A01): every registered route, called by A with ids of B → 404,
// nothing of B leaks or changes; no session → 401; unknown role → 403. A new route with an id that is not
// in SAMPLES makes this test fail until it is added.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeHarness, validSpool, B_TOKEN, type Harness } from '../harness';

let h: Harness;
const b: Record<string, string> = {};

beforeAll(async () => {
  h = await makeHarness();
  const r = await h.call('POST', '/api/v1/spools', { token: B_TOKEN, body: validSpool() });
  const out = r.json.data as { filament: { id: string }; spool: { id: string } };
  b.filament = out.filament.id;
  b.spool = out.spool.id;
  await h.call('POST', '/api/v1/spools', { body: validSpool({ filament: { material: 'PLA', color: 'Rojo' } }) });
});
afterAll(() => h.close());

/** How to call each route with ids of workspace B. */
const SAMPLES: Record<string, { path: () => string; body?: () => unknown }> = {
  'GET /api/v1/filaments/:id': { path: () => `/api/v1/filaments/${b.filament}` },
};

const snapshotB = async () => JSON.stringify([
  (await h.call('GET', '/api/v1/filaments', { token: B_TOKEN })).json.data,
  (await h.call('GET', `/api/v1/filaments/${b.filament}`, { token: B_TOKEN })).json.data,
]);

describe('access matrix', () => {
  it('every route with an id has a sample', () => {
    const withId = h.app.routes.filter((r) => r.path.includes(':')).map((r) => `${r.method} ${r.path}`);
    expect(withId.filter((k) => !SAMPLES[k])).toEqual([]);
  });

  it('A calling routes with ids of B gets 404, without B ids in the answer, and B is unchanged', async () => {
    const before = await snapshotB();
    for (const r of h.app.routes.filter((x) => x.path.includes(':'))) {
      const s = SAMPLES[`${r.method} ${r.path}`]!;
      const res = await h.call(r.method, s.path(), s.body ? { body: s.body() } : {});
      expect(res.status, `${r.method} ${r.path}`).toBe(404);
      const text = JSON.stringify(res.json);
      for (const id of Object.values(b)) expect(text).not.toContain(id);
    }
    expect(await snapshotB()).toBe(before);
  });

  it('lists of A never contain anything of B', async () => {
    for (const r of h.app.routes.filter((x) => x.method === 'GET' && !x.path.includes(':'))) {
      const text = JSON.stringify((await h.call('GET', r.path)).json);
      for (const id of Object.values(b)) expect(text, r.path).not.toContain(id);
    }
  });

  it('no session → 401 on every route', async () => {
    for (const r of h.app.routes) {
      const path = r.path.replace(/:[a-zA-Z]+/g, '00000000-0000-7000-8000-000000000000');
      const res = await h.call(r.method, path, { token: null, ...(r.method === 'GET' || r.method === 'DELETE' ? {} : { body: {} }) });
      expect(res.status, `${r.method} ${r.path}`).toBe(401);
      expect(res.json.code).toBe('UNAUTHENTICATED');
    }
  });

  it('an unknown role → 403 on every route (deny by default)', async () => {
    for (const r of h.app.routes) {
      const path = r.path.replace(/:[a-zA-Z]+/g, '00000000-0000-7000-8000-000000000000');
      const res = await h.call(r.method, path, { token: 'token-nobody', ...(r.method === 'GET' || r.method === 'DELETE' ? {} : { body: {} }) });
      expect(res.status, `${r.method} ${r.path}`).toBe(403);
    }
  });

  it('invalid ids (not UUID, injection, relative paths) → 404 before the database', async () => {
    for (const bad of ['abc', "1'%20or%20'1'='1", '..%2F..%2Fetc%2Fpasswd', '00000000-0000-0000-0000-00000000000g']) {
      expect((await h.call('GET', `/api/v1/filaments/${bad}`)).status).toBe(404);
    }
  });

  it('unknown API routes → 404 JSON', async () => {
    const r = await h.call('GET', '/api/v1/nope');
    expect(r.status).toBe(404);
    expect(r.json.code).toBe('NOT_FOUND');
  });
});
