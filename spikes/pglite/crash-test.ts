// Kill -9 a writer mid-transaction several times; on reopen every committed batch must be complete.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { openPglite } from './db.ts';

if (process.argv[2] === 'writer') {
  const p = await openPglite(process.argv[3]);
  const r: any = await p.db.execute(sql`select coalesce(max(batch), 0)::int as b, coalesce(max(id), 0)::int as i from crash_row`);
  let batch = (r.rows[0].b as number) + 1; let id = r.rows[0].i as number;
  for (;;) {
    await p.client.transaction(async (tx) => {
      for (let k = 0; k < 100; k++) await tx.query('insert into crash_row (id, batch, payload) values ($1, $2, $3)', [++id, batch, 'x'.repeat(200)]);
    });
    process.stdout.write(`committed ${batch}\n`);
    batch++;
  }
}

const dir = mkdtempSync(join(tmpdir(), 'pglcrash-'));
const rounds: unknown[] = [];
for (let round = 1; round <= 8; round++) {
  const child = spawn(process.execPath, ['--import', 'tsx', new URL(import.meta.url).pathname, 'writer', dir], { stdio: ['ignore', 'pipe', 'inherit'] });
  let committed = 0;
  child.stdout.on('data', (d: Buffer) => { const m = [...d.toString().matchAll(/committed (\d+)/g)].at(-1); if (m) committed = +m[1]!; });
  await new Promise((r) => setTimeout(r, 2500 + round * 400));
  child.kill('SIGKILL');
  await new Promise((r) => child.on('exit', r));
  const p = await openPglite(dir);
  const res: any = await p.db.execute(sql`select batch, count(*)::int as n from crash_row group by batch`);
  const partial = res.rows.filter((x: any) => x.n !== 100).length;
  const maxBatch = Math.max(0, ...res.rows.map((x: any) => x.batch));
  const byIndex: any = await p.db.execute(sql`select count(*)::int as n from crash_row where batch > 0`);
  const total: any = await p.db.execute(sql`select count(*)::int as n from crash_row`);
  await p.close();
  const ok = partial === 0 && maxBatch >= committed && byIndex.rows[0].n === total.rows[0].n;
  rounds.push({ round, committedReported: committed, batchesFound: res.rows.length, partial, rows: total.rows[0].n, ok });
  console.log(JSON.stringify(rounds.at(-1)));
  if (!ok) process.exitCode = 1;
}
rmSync(dir, { recursive: true, force: true });
writeFileSync(new URL('./results/crash.json', import.meta.url), JSON.stringify(rounds, null, 2));
process.exit(process.exitCode ?? 0);
