// Integration: "agregar rollo → aparece en la lista", through HTTP.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '@app/db';
import type { AddSpoolResult, FilamentDetail, FilamentList } from '@app/contract';
import { appFor, ctxA, ctxB, spoolInput, testDatabase } from './helpers';

let database: Database;
beforeAll(async () => {
  database = await testDatabase();
});
afterAll(() => database.close());

const json = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

describe('filament routes', () => {
  it('add a spool → it appears in the list', async () => {
    const app = appFor(database, ctxA);
    expect(((await (await app.request('/api/v1/filaments')).json()) as FilamentList).items).toEqual([]);

    const res = await app.request('/api/v1/filaments/spools', json(spoolInput({ material: 'PLA Silk', color: 'Morado', hex: '#7b4bd0', costCents: 43000 })));
    expect(res.status).toBe(201);
    const added = (await res.json()) as AddSpoolResult;

    const list = (await (await app.request('/api/v1/filaments')).json()) as FilamentList;
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({ id: added.filament.id, material: 'PLA Silk', color: 'Morado', remainingGrams: 1000, spoolCount: 1 });
    expect(list.totals).toEqual({ filaments: 1, spools: 1, remainingGrams: 1000, valueCents: 47000 });

    const detail = (await (await app.request(`/api/v1/filaments/${added.filament.id}`)).json()) as FilamentDetail;
    expect(detail.spools.map((s) => s.id)).toEqual([added.spoolId]);
  });

  it('validation errors come back as 422 VALIDATION_FAILED', async () => {
    const res = await appFor(database, ctxA).request('/api/v1/filaments/spools', json({ material: '', color: 'x' }));
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('another business cannot see the filament (404)', async () => {
    const list = (await (await appFor(database, ctxA).request('/api/v1/filaments')).json()) as FilamentList;
    const id = list.items[0]!.id;
    const res = await appFor(database, ctxB).request(`/api/v1/filaments/${id}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ code: 'FILAMENT_NOT_FOUND' });
    expect(((await (await appFor(database, ctxB).request('/api/v1/filaments')).json()) as FilamentList).items).toEqual([]);
  });

  it('with a launch secret, requests without it are 401', async () => {
    const { createLocalAuth } = await import('../src/providers/local/auth');
    const app = appFor(database, ctxA, { auth: createLocalAuth({ ...ctxA, secret: 's3cret' }) });
    expect((await app.request('/api/v1/filaments')).status).toBe(401);
    expect((await app.request('/api/v1/filaments', { headers: { 'x-app-secret': 's3cret' } })).status).toBe(200);
  });
});

describe('workspace route', () => {
  it('returns the caller business only', async () => {
    expect(await (await appFor(database, ctxA).request('/api/v1/workspace')).json()).toEqual({ id: ctxA.workspaceId, name: 'A' });
    expect(await (await appFor(database, ctxB).request('/api/v1/workspace')).json()).toEqual({ id: ctxB.workspaceId, name: 'B' });
  });
});
