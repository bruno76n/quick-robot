// logPrintRun choosing the spool (ronda-4 §2.5, docs/04 §1 cases 1.5a–b, docs/12 §8): the chosen spools first, the rest in
// the use order; SPOOL_NOT_IN_FILAMENT, SPOOL_INSUFFICIENT, another workspace (404) and failure midway; without spools, as before.
import type { PrintRunInput } from '@app/contract';
import { listSpoolMovements, listSpools } from '@app/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addSpool } from '../../src/usecases/add-spool';
import { logPrintRun } from '../../src/usecases/sell/production';
import { deleteSpool, recordSpoolMovement } from '../../src/usecases/spools';
import { B_TOKEN, failOnWrite, makeHarness, validSpool, type Harness } from '../harness';

let h: Harness;
beforeAll(async () => { h = await makeHarness(); });
afterAll(() => h.close());

let k = 0;
/** A filament with two spools: an older full one (#a) and a newer one opened down to `left` grams (#b). */
async function twoSpools(left: number, olderLeft = 1000) {
  const color = `Gris ${++k}`;
  const older = await addSpool(h.deps, h.A, validSpool({ filament: { material: 'PLA', color }, costCents: 25000, shippingCents: 0, purchasedOn: '2026-10-10' }));
  const newer = await addSpool(h.deps, h.A, validSpool({ filament: { material: 'PLA', color }, costCents: 30000, shippingCents: 0, purchasedOn: '2026-11-05' }));
  if (olderLeft < 1000) await recordSpoolMovement(h.deps, h.A, older.spool.id, { kind: 'consumption', grams: -(1000 - olderLeft), on: '2026-11-06' });
  await recordSpoolMovement(h.deps, h.A, newer.spool.id, { kind: 'consumption', grams: -(1000 - left), on: '2026-11-06' });
  return { filamentId: older.filament.id, older: older.spool.id, newer: newer.spool.id };
}
const run = (filaments: PrintRunInput['filaments'], ctx = h.A, deps = h.deps) =>
  logPrintRun(deps, ctx, { on: '2026-11-07', text: 'Prueba', qty: 1, result: 'ok', hours: 0, reason: 'test', filaments });
const left = async (filamentId: string) => new Map((await listSpools(h.db, h.A, [filamentId])).map((s) => [s.id, s.remainingGrams]));
const runMoves = async (filamentId: string, refId: string) => (await listSpoolMovements(h.db, h.A, filamentId)).filter((m) => m.refId === refId)
  .map((m) => [m.spoolId, m.kind, m.grams]).sort((a, b) => String(a).localeCompare(String(b)));

describe('logPrintRun with chosen spools', () => {
  it('case 1.5a: purge 5 %, a 50 g piece from a spool with 100 g → 47.5 g (consumption 50.0, purge 2.5); the other spool is untouched', async () => {
    const f = await twoSpools(1000);
    await recordSpoolMovement(h.deps, h.A, f.newer, { kind: 'consumption', grams: -900, on: '2026-11-06' });
    // Without a choice the opened (newer) spool would go first too; choose the older full one to see the choice win.
    const r = await run([{ filamentId: f.filamentId, grams: 50, spools: [{ spoolId: f.older, grams: 52.5 }] }]);
    expect((await left(f.filamentId)).get(f.older)).toBe(947.5);
    expect((await left(f.filamentId)).get(f.newer)).toBe(100);
    expect(await runMoves(f.filamentId, r.data.id)).toEqual([[f.older, 'consumption', -50], [f.older, 'waste', -2.5]].sort((a, b) => String(a).localeCompare(String(b))));
    const g = await run([{ filamentId: f.filamentId, grams: 50, spools: [{ spoolId: f.newer }] }]);
    expect((await left(f.filamentId)).get(f.newer)).toBe(47.5);
    expect(r.warnings).toEqual([]);
    expect(g.data.grams).toBe(50);
  });

  it('case 1.5b: «#7 what it has + the rest from #5»: #7 30 → 0 (28.6 + 1.4), #5 640 → 617.5 (21.4 + 1.1)', async () => {
    const f = await twoSpools(30, 640);
    const r = await run([{ filamentId: f.filamentId, grams: 50, spools: [{ spoolId: f.newer }, { spoolId: f.older }] }]);
    const l = await left(f.filamentId);
    expect([l.get(f.newer), l.get(f.older)]).toEqual([0, 617.5]);
    const moves = await runMoves(f.filamentId, r.data.id);
    expect(moves).toContainEqual([f.newer, 'consumption', -28.6]);
    expect(moves).toContainEqual([f.newer, 'waste', -1.4]);
    expect(moves).toContainEqual([f.older, 'consumption', -21.4]);
    expect(moves).toContainEqual([f.older, 'waste', -1.1]);
  });

  it('what the chosen spool does not cover comes from the others in the use order', async () => {
    const f = await twoSpools(30, 640);
    await run([{ filamentId: f.filamentId, grams: 50, spools: [{ spoolId: f.newer }] }]);
    const l = await left(f.filamentId);
    expect([l.get(f.newer), l.get(f.older)]).toEqual([0, 617.5]);
  });

  it('without spools: the automatic order as before (the opened spool first)', async () => {
    const f = await twoSpools(400);
    await run([{ filamentId: f.filamentId, grams: 100 }]);
    const l = await left(f.filamentId);
    expect([l.get(f.newer), l.get(f.older)]).toEqual([295, 1000]);
  });

  it('a spool of another filament → SPOOL_NOT_IN_FILAMENT 422 with its id, nothing written', async () => {
    const f = await twoSpools(400);
    const g = await twoSpools(400);
    const before = await left(f.filamentId);
    const runs = ((await h.call('GET', '/api/v1/print-runs')).json.data as { total: number }).total;
    const res = await h.call('POST', '/api/v1/print-runs', { body: { on: '2026-11-07', text: 'Prueba', qty: 1, result: 'ok', hours: 0, reason: 'test', filaments: [{ filamentId: f.filamentId, grams: 10, spools: [{ spoolId: g.newer }] }] } });
    expect([res.status, res.json.code, res.json.details]).toEqual([422, 'SPOOL_NOT_IN_FILAMENT', { spoolId: g.newer }]);
    expect(await left(f.filamentId)).toEqual(before);
    expect((await h.call('GET', '/api/v1/print-runs')).json.data).toMatchObject({ total: runs });
  });

  it('more than the spool has → SPOOL_INSUFFICIENT 422 with what it has, nothing written', async () => {
    const f = await twoSpools(30);
    const res = await h.call('POST', '/api/v1/print-runs', { body: { on: '2026-11-07', text: 'Prueba', qty: 1, result: 'ok', hours: 0, reason: 'test', filaments: [{ filamentId: f.filamentId, grams: 50, spools: [{ spoolId: f.newer, grams: 40 }] }] } });
    expect([res.status, res.json.code, res.json.details]).toEqual([422, 'SPOOL_INSUFFICIENT', { availableGrams: 30 }]);
    expect((await left(f.filamentId)).get(f.newer)).toBe(30);
  });

  it('a spool of another workspace or a deleted spool → 404, nothing written', async () => {
    const f = await twoSpools(400);
    const theirs = await addSpool(h.deps, h.B, validSpool({ filament: { material: 'PLA', color: 'Ajeno' } }));
    await expect(run([{ filamentId: f.filamentId, grams: 10, spools: [{ spoolId: theirs.spool.id }] }])).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const res = await h.call('POST', '/api/v1/print-runs', { token: B_TOKEN, body: { on: '2026-11-07', text: 'Prueba', qty: 1, result: 'ok', hours: 0, reason: 'test', filaments: [{ filamentId: theirs.filament.id, grams: 10, spools: [{ spoolId: f.newer }] }] } });
    expect(res.status).toBe(404);
    await deleteSpool(h.deps, h.A, f.older);
    await expect(run([{ filamentId: f.filamentId, grams: 10, spools: [{ spoolId: f.older }] }])).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await left(f.filamentId)).get(f.newer)).toBe(400);
  });

  it('invalid choices → 422: a part of 0 g, more than 10 spools', async () => {
    const f = await twoSpools(400);
    const body = (spools: unknown) => ({ on: '2026-11-07', text: 'Prueba', qty: 1, result: 'ok', hours: 0, reason: 'test', filaments: [{ filamentId: f.filamentId, grams: 10, spools }] });
    expect((await h.call('POST', '/api/v1/print-runs', { body: body([{ spoolId: f.newer, grams: 0 }]) })).status).toBe(422);
    expect((await h.call('POST', '/api/v1/print-runs', { body: body(Array.from({ length: 11 }, () => ({ spoolId: f.newer }))) })).status).toBe(422);
  });

  it.each([1, 2, 3])('failing on write #%i with chosen spools leaves the spools and the runs as they were', async (n) => {
    const f = await twoSpools(30, 640);
    const before = await left(f.filamentId);
    const runs = ((await h.call('GET', '/api/v1/print-runs')).json.data as { total: number }).total;
    await expect(run([{ filamentId: f.filamentId, grams: 50, spools: [{ spoolId: f.newer }, { spoolId: f.older }] }], h.A, { ...h.deps, db: failOnWrite(h.db, n) })).rejects.toThrow(/injected/);
    expect(await left(f.filamentId)).toEqual(before);
    expect(((await h.call('GET', '/api/v1/print-runs')).json.data as { total: number }).total).toBe(runs);
  });
});
