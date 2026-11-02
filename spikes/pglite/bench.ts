// Criteria 1 and 2: same migrations on PGlite and Postgres; report query < 200 ms with ~5 000 sales.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { openPglite, openPostgres } from './db.ts';
import { seedLoad, WS_A } from './seed-load.ts';
import { salesByProductQuery, monthlyQuery } from './report-query.ts';

function stats(xs: number[]) {
  const a = [...xs].sort((x, y) => x - y);
  const q = (p: number) => a[Math.min(a.length - 1, Math.floor(p * a.length))]!;
  return { runs: a.length, min: +a[0]!.toFixed(2), p50: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), max: +a[a.length - 1]!.toFixed(2) };
}

async function measure(label: string, db: any, runs = 50) {
  const r1 = await db.execute(salesByProductQuery(WS_A, '2025-11-01', '2026-10-31'));
  const rows = (r1.rows ?? r1).length;
  const times: number[] = [];
  const timesMonthly: number[] = [];
  for (let i = 0; i < runs; i++) {
    let t = performance.now();
    await db.execute(salesByProductQuery(WS_A, '2025-11-01', '2026-10-31'));
    times.push(performance.now() - t);
    t = performance.now();
    await db.execute(monthlyQuery(WS_A, '2025-11-01', '2026-10-31'));
    timesMonthly.push(performance.now() - t);
  }
  return { label, rows, salesByProduct: stats(times), monthly: stats(timesMonthly) };
}

const results: any = { date: new Date().toISOString() };
const dir = mkdtempSync(join(tmpdir(), 'pglite-bench-'));
try {
  // PGlite on disk (the real local mode)
  let t = performance.now();
  const { client, db } = await openPglite(join(dir, 'data'));
  results.pgliteOpenAndMigrateMs = +(performance.now() - t).toFixed(1);
  results.pgliteVersion = (await client.query<{ v: string }>('select version() as v')).rows[0]!.v;
  t = performance.now();
  await seedLoad(db, 5000);
  results.pgliteSeedMs = +(performance.now() - t).toFixed(1);
  const counts = await client.query<{ sales: number; items: number }>(
    `select (select count(*)::int from sale where workspace_id = '${WS_A}') sales, (select count(*)::int from line_item where workspace_id = '${WS_A}') items`,
  );
  results.workspaceA = counts.rows[0];
  results.pgliteFile = await measure('pglite-file', db);
  await client.close();

  // PGlite reopened (cold)
  t = performance.now();
  const reopened = await openPglite(join(dir, 'data'));
  results.pgliteReopenMs = +(performance.now() - t).toFixed(1);
  results.pgliteReopened = await measure('pglite-file-reopened', reopened.db, 20);
  await reopened.client.close();

  // Postgres 16 server with the same migrations folder
  try {
    const { pool, db: pgdb } = await openPostgres('spike_bench');
    await seedLoad(pgdb, 5000);
    results.postgres = await measure('postgres', pgdb);
    results.postgresVersion = (await pool.query('select version() as v')).rows[0].v;
    results.sameMigrationsOnPostgres = true;
    await pool.end();
  } catch (e) {
    results.sameMigrationsOnPostgres = false;
    results.postgresError = String(e);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
writeFileSync(new URL('./results/bench.json', import.meta.url), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
