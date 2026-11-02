// Isolation between businesses: with A's ctx nothing of B is ever returned or modified.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { filamentRepo, type Ctx, type Database } from '../src';
import { filament } from '../src/schema';
import { eq } from 'drizzle-orm';
import { ctxA, ctxB, twoWorkspaces } from './helpers';

let database: Database;
const ids = { A: { filament: '', spool: '' }, B: { filament: '', spool: '' } };

async function seedSimilar(ctx: Ctx) {
  const f = await filamentRepo.create(database.db, ctx, { material: 'PLA', color: 'Negro', hex: '#26242b', nameKey: 'pla|negro' });
  const s = await filamentRepo.insertSpool(database.db, ctx, { filamentId: f.id, brand: 'eSUN', costCents: 32000, shippingCents: 4000, grams: 1000, purchasedOn: '2026-10-01', supplierId: null });
  await filamentRepo.insertMovement(database.db, ctx, { spoolId: s.id, on: '2026-10-01', kind: 'purchase', grams: 1000, note: 'Compra del rollo' });
  await filamentRepo.insertMovement(database.db, ctx, { spoolId: s.id, on: '2026-10-05', kind: 'consumption', grams: ctx === ctxA ? -100 : -300, note: '' });
  return { filament: f.id, spool: s.id };
}

beforeAll(async () => {
  database = await twoWorkspaces();
  ids.A = await seedSimilar(ctxA);
  ids.B = await seedSimilar(ctxB);
});
afterAll(() => database.close());

describe('tenancy: reads', () => {
  it('list returns only own filaments', async () => {
    const a = await filamentRepo.list(database.db, ctxA);
    expect(a.map((f) => f.id)).toEqual([ids.A.filament]);
  });
  it('same name key resolves to own filament', async () => {
    expect((await filamentRepo.findByKey(database.db, ctxA, 'pla|negro'))?.id).toBe(ids.A.filament);
    expect((await filamentRepo.findByKey(database.db, ctxB, 'pla|negro'))?.id).toBe(ids.B.filament);
  });
  it('get by id of the other business returns nothing', async () => {
    expect(await filamentRepo.get(database.db, ctxA, ids.B.filament)).toBeUndefined();
    expect(await filamentRepo.getSpool(database.db, ctxA, ids.B.spool)).toBeUndefined();
  });
  it('spools, sums and movements never include the other business', async () => {
    expect(await filamentRepo.listSpools(database.db, ctxA, [ids.B.filament])).toEqual([]);
    expect((await filamentRepo.listSpools(database.db, ctxA)).map((s) => s.id)).toEqual([ids.A.spool]);
    const sums = await filamentRepo.remainingBySpool(database.db, ctxA);
    expect([...sums.entries()]).toEqual([[ids.A.spool, 900]]);
    expect(await filamentRepo.listMovements(database.db, ctxA, [ids.B.spool])).toEqual([]);
  });
});

describe('tenancy: writes', () => {
  it('cannot attach a spool to the other business filament', async () => {
    await expect(
      filamentRepo.insertSpool(database.db, ctxA, { filamentId: ids.B.filament, brand: 'x', costCents: 1, shippingCents: 0, grams: 1, purchasedOn: '2026-10-01', supplierId: null }),
    ).rejects.toThrow();
  });
  it('cannot add a movement to the other business spool', async () => {
    await expect(filamentRepo.insertMovement(database.db, ctxA, { spoolId: ids.B.spool, on: '2026-10-06', kind: 'adjustment', grams: -500, note: '' })).rejects.toThrow();
    const sumsB = await filamentRepo.remainingBySpool(database.db, ctxB);
    expect(sumsB.get(ids.B.spool)).toBe(700);
  });
  it('restore with A ctx does not touch B', async () => {
    const deletedAt = new Date('2026-10-10T00:00:00Z');
    await database.db.update(filament).set({ deletedAt }).where(eq(filament.id, ids.B.filament));
    await filamentRepo.restore(database.db, ctxA, ids.B.filament);
    const [row] = await database.db.select().from(filament).where(eq(filament.id, ids.B.filament));
    expect(row!.deletedAt).toEqual(deletedAt);
    await database.db.update(filament).set({ deletedAt: null }).where(eq(filament.id, ids.B.filament));
  });
  it('a repository call without workspace is rejected before any SQL', async () => {
    await expect(filamentRepo.list(database.db, {} as Ctx)).rejects.toThrow(/workspaceId/);
  });
});
