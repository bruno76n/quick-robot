// docs/11 · A06 on a real Postgres (cloud): two simultaneous withdrawals cannot take more than there is.
// Needs PG_URL (CI starts Postgres 16); skipped otherwise.
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectPostgres, ensureWorkspace, type Database } from '@app/db';
import { addSpool } from '../../src/usecases/add-spool';
import { recordSpoolMovement } from '../../src/usecases/spools';
import { createSupply, recordSupplyMovement } from '../../src/usecases/supplies';
import { getSupplyDetail } from '../../src/queries/supplies';
import { ctxA, spoolInput, useCaseDeps } from '../helpers';

const url = process.env.PG_URL;
let database: Database;

describe.skipIf(!url)('concurrency on Postgres', () => {
  beforeAll(async () => {
    const admin = new pg.Client({ connectionString: url });
    await admin.connect();
    await admin.query('drop database if exists app_concurrency_test');
    await admin.query('create database app_concurrency_test');
    await admin.end();
    database = await connectPostgres({ url: url!.replace(/\/[^/]*$/, '/app_concurrency_test'), max: 8 });
    await ensureWorkspace(database.db, { workspaceId: ctxA.workspaceId, workspaceName: 'A', userId: ctxA.userId, userEmail: 'a@example.test', userName: 'A' });
  });
  afterAll(() => database?.close());

  it('10 simultaneous uses of 4 from a stock of 10 → exactly 2 succeed', async () => {
    const deps = useCaseDeps(database);
    const s = await createSupply(deps, ctxA, { name: 'Carrera', costCents: 10, initialQty: 10, on: '2026-11-01' });
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => recordSupplyMovement(deps, ctxA, s.id, { kind: 'use', qty: 4, on: '2026-11-01' })));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
    expect((await getSupplyDetail(database.db, ctxA, s.id)).stock).toBe(2);
  });

  it('simultaneous consumptions never leave a spool below zero', async () => {
    const deps = useCaseDeps(database);
    const r = await addSpool(deps, ctxA, spoolInput({ grams: 100 }));
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => recordSpoolMovement(deps, ctxA, r.spoolId, { kind: 'consumption', grams: 30, on: '2026-11-01' })));
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(3);
  });
});
