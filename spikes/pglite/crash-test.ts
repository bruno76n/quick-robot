// Criterion 3: kill -9 the process while it writes, reopen, check nothing is corrupted or half-written.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openPglite } from './db.ts';

const ROUNDS = Number(process.env.ROUNDS ?? 8);
const dir = mkdtempSync(join(tmpdir(), 'pglite-crash-'));
const dataDir = join(dir, 'data');
const rounds: any[] = [];
let ok = true;

function runAndKill(afterMs: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'crash-writer.ts', dataDir], { cwd: import.meta.dirname });
    let last = -1;
    let buf = '';
    child.stdout.on('data', (d) => {
      buf += d;
      const lines = buf.split('\n');
      buf = lines.pop()!;
      for (const l of lines) {
        if (l === 'READY') setTimeout(() => child.kill('SIGKILL'), afterMs);
        const m = /^COMMIT (\d+)$/.exec(l);
        if (m) last = Number(m[1]);
      }
    });
    child.stderr.on('data', (d) => process.stderr.write(d));
    child.on('exit', (_code, signal) => (signal === 'SIGKILL' ? resolve(last) : reject(new Error('child exited without kill'))));
  });
}

try {
  for (let r = 0; r < ROUNDS; r++) {
    const killAfter = 300 + Math.floor(Math.random() * 1500);
    const lastCommitted = await runAndKill(killAfter);
    const { client } = await openPglite(dataDir);
    const res = (
      await client.query<{ rows: number; batches: number; maxseq: number; partial: number }>(`
      select count(*)::int as rows, count(distinct seq)::int as batches, coalesce(max(seq), -1)::int as maxseq,
             (select count(*)::int from (select seq from spool_movement group by seq having count(*) <> 100) x) as partial
        from spool_movement`)
    ).rows[0]!;
    // index scan vs heap scan must agree
    await client.query('set enable_seqscan = off');
    const viaIndex = (await client.query<{ n: number }>(`select count(*)::int n from spool_movement where workspace_id = '00000000-0000-7000-8000-00000000000a'`)).rows[0]!.n;
    await client.query('reset enable_seqscan');
    await client.close();
    const pass = res.partial === 0 && res.maxseq >= lastCommitted && res.batches === res.maxseq + 1 && viaIndex === res.rows;
    ok &&= pass;
    rounds.push({ round: r + 1, killAfterMs: killAfter, lastCommittedReported: lastCommitted, ...res, viaIndex, pass });
    console.log(rounds.at(-1));
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
writeFileSync(new URL('./results/crash.json', import.meta.url), JSON.stringify({ pass: ok, rounds }, null, 2));
console.log(ok ? 'CRASH TEST PASS' : 'CRASH TEST FAIL');
process.exit(ok ? 0 : 1);
