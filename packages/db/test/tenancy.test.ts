// Workspace A never sees nor modifies anything of workspace B (docs/05 › Aislamiento, docs/14 §4).
import { getTableColumns, getTableName, isTable } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Connection } from '../src/connect';
import * as schema from '../src/schema';
import {
  findFilamentByKey, getFilament, getSpool, insertFilament, insertSpool, insertSpoolMovements, listFilaments,
  listSpoolMovements, listSpools, lockSpoolsOfFilament,
} from '../src/repos/filament-repo';
import { getRole, getWorkspace } from '../src/repos/workspace-repo';
import { openTestDb } from '../src/testing';
import { twoWorkspaces, uid, type WsData } from './fixtures';

/** Tables covered by this file. A new table with workspace_id must be added here (and tested). */
const COVERED = new Set(['membership', 'filament', 'spool', 'spool_movement']);
const WITHOUT_WORKSPACE = new Set(['workspace', 'user']);

let conn: Connection;
let A: WsData;
let B: WsData;
beforeAll(async () => {
  conn = await openTestDb();
  ({ A, B } = await twoWorkspaces(conn.db));
});
afterAll(() => conn.close());

describe('schema', () => {
  const tables = Object.values(schema).filter((t) => isTable(t)) as Parameters<typeof getTableName>[0][];
  it.each(tables.map((t) => [getTableName(t), t] as const))('%s has workspace_id and is covered', (name, t) => {
    if (WITHOUT_WORKSPACE.has(name)) return;
    expect(Object.values(getTableColumns(t)).map((c) => c.name)).toContain('workspace_id');
    expect(COVERED.has(name)).toBe(true);
  });
});

describe('reads with ctx A never return B', () => {
  it('workspace and role', async () => {
    expect((await getWorkspace(conn.db, A.ctx))?.name).toBe('Negocio A');
    expect(await getRole(conn.db, { workspaceId: A.ctx.workspaceId, userId: B.ctx.userId })).toBeUndefined();
  });
  it('lists only its own filaments, also when searching', async () => {
    for (const q of [undefined, 'PLA', 'Negro', 'PLA Negro']) {
      const r = await listFilaments(conn.db, A.ctx, { q, page: 1, pageSize: 50 });
      expect(r.items.map((f) => f.id)).toEqual([A.filamentId]);
      expect(r.total).toBe(1);
    }
  });
  it('lookups by id or key of B find nothing', async () => {
    expect(await getFilament(conn.db, A.ctx, B.filamentId)).toBeUndefined();
    expect((await findFilamentByKey(conn.db, A.ctx, 'pla|negro'))?.id).toBe(A.filamentId);
    expect(await getSpool(conn.db, A.ctx, B.spoolId)).toBeUndefined();
    expect(await listSpools(conn.db, A.ctx, [B.filamentId])).toEqual([]);
    expect(await listSpoolMovements(conn.db, A.ctx, B.filamentId)).toEqual([]);
  });
  it('sums (spool_levels) only count its own ledger', async () => {
    const [s] = await listSpools(conn.db, A.ctx, [A.filamentId, B.filamentId]);
    expect(s?.remainingGrams).toBe(1000);
  });
});

describe('writes with ctx A never touch B', () => {
  it('cannot attach a spool to a filament of B (composite foreign key)', async () => {
    await expect(insertSpool(conn.db, A.ctx, { id: uid(0xa), filamentId: B.filamentId, brand: '', costCents: 1, shippingCents: 0, grams: 1, purchasedOn: '2026-11-01' })).rejects.toThrow();
  });
  it('cannot add a movement to a spool of B', async () => {
    await expect(insertSpoolMovements(conn.db, A.ctx, [{ id: uid(0xa), spoolId: B.spoolId, on: '2026-11-01', kind: 'consumption', grams: -10, note: '' }])).rejects.toThrow();
    expect((await listSpools(conn.db, B.ctx, [B.filamentId]))[0]?.remainingGrams).toBe(1000);
  });
  it('the same filament name is allowed in both workspaces', async () => {
    expect((await findFilamentByKey(conn.db, B.ctx, 'pla|negro'))?.id).toBe(B.filamentId);
  });
  it('locking A spools does not lock B', async () => {
    await conn.db.transaction(async (tx) => {
      await lockSpoolsOfFilament(tx, A.ctx, B.filamentId);
      await lockSpoolsOfFilament(tx, A.ctx, A.filamentId);
    });
  });
});

describe('a repository without ctx fails before SQL', () => {
  it.each([
    ['listFilaments', () => listFilaments(conn.db, undefined as never, { page: 1, pageSize: 1 })],
    ['getFilament', () => getFilament(conn.db, { workspaceId: '', userId: '' }, A.filamentId)],
    ['insertFilament', () => insertFilament(conn.db, { workspaceId: 'x', userId: 'x' }, { id: uid(1), material: 'a', color: 'b', hex: '#000000', nameKey: 'a|b' })],
    ['insertSpoolMovements', () => insertSpoolMovements(conn.db, null as never, [])],
  ])('%s', async (_n, fn) => {
    await expect(fn()).rejects.toThrow(/ctx/);
  });
});
