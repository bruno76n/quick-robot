import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openPglite, openPostgres } from './db.ts';
import { seedLoad } from './seed-load.ts';
import { salesByProduct } from './report-query.ts';

const pct = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(p * s.length))]!.toFixed(1); };
async function measure(fn: () => Promise<unknown>, runs = 30) {
  await fn(); const t: number[] = [];
  for (let i = 0; i < runs; i++) { const a = performance.now(); await fn(); t.push(performance.now() - a); }
  return { p50: pct(t, 0.5), p95: pct(t, 0.95), max: pct(t, 1) };
}
const results: Record<string, unknown> = { pglite: '0.5.10', node: process.version, cpus: (await import('node:os')).cpus().length };
for (const n of [5000, 25000]) {
  const dir = mkdtempSync(join(tmpdir(), 'pgl-'));
  const t0 = performance.now();
  const p = await openPglite(dir);
  const created = performance.now() - t0;
  const ts = performance.now(); const seeded = await seedLoad(p.db, n); const seedMs = performance.now() - ts;
  const year = await measure(() => salesByProduct(p.db, '2025-11-02', '2026-11-01'));
  const all = await measure(() => salesByProduct(p.db, null, '2026-11-01'), 15);
  await p.close();
  const tr = performance.now(); const p2 = await openPglite(dir); const reopen = performance.now() - tr;
  const cold = await measure(() => salesByProduct(p2.db, '2025-11-02', '2026-11-01'), 10);
  await p2.close(); rmSync(dir, { recursive: true, force: true });
  let pgRes: unknown = 'skipped';
  try { const pg = await openPostgres(); await seedLoad(pg.db, n); pgRes = { year: await measure(() => salesByProduct(pg.db, '2025-11-02', '2026-11-01')), all: await measure(() => salesByProduct(pg.db, null, '2026-11-01'), 15) }; await pg.close(); } catch (e) { pgRes = `unavailable: ${(e as Error).message}`; }
  results[`sales_${n}`] = { ...seeded, createMs: Math.round(created), seedMs: Math.round(seedMs), reopenMs: Math.round(reopen), year12m: year, all, year12mAfterReopen: cold, postgres: pgRes };
  console.log(n, JSON.stringify(results[`sales_${n}`]));
}
writeFileSync(new URL('./results/bench.json', import.meta.url), JSON.stringify(results, null, 2));
process.exit(process.exitCode ?? 0);
