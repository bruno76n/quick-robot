// Criterion 5: row level security as a second barrier (policy on current_setting('app.workspace_id')).
import { writeFileSync } from 'node:fs';
import { openPglite, openPostgres } from './db.ts';
import { seedLoad, WS_A, WS_B } from './seed-load.ts';

const setup = [
  `do $$ begin if not exists (select 1 from pg_roles where rolname = 'app_user') then create role app_user nologin; end if; end $$`,
  `grant select, insert, update, delete on all tables in schema public to app_user`,
  `alter table sale enable row level security`,
  `alter table sale force row level security`,
  `create policy sale_ws on sale using (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid) with check (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)`,
];

type Q = (sql: string, params?: unknown[]) => Promise<{ rows: any[]; affected: number }>;

async function checks(q: Q, tx: (fn: (q: Q) => Promise<void>) => Promise<void>) {
  const out: Record<string, unknown> = {};
  for (const s of setup) await q(s);
  out.totalAsOwner = (await q('select count(*)::int n from sale')).rows[0].n;
  await tx(async (t) => {
    await t('set local role app_user');
    await t(`select set_config('app.workspace_id', $1, true)`, [WS_A]);
    out.visibleAsA = (await t('select count(*)::int n from sale')).rows[0].n;
    out.bRowsVisibleAsA = (await t('select count(*)::int n from sale where workspace_id = $1', [WS_B])).rows[0].n;
    out.updateBAsA = (await t(`update sale set channel = 'x' where workspace_id = $1`, [WS_B])).affected;
    try {
      await t(`insert into sale (id, workspace_id, "on", channel) values (gen_random_uuid(), $1, '2026-01-01', 'x')`, [WS_B]);
      out.insertIntoBAsA = 'allowed';
    } catch (e) {
      out.insertIntoBAsA = 'rejected';
      throw Object.assign(new Error('rollback'), { expected: true });
    }
  }).catch((e) => { if (!e.expected) throw e; });
  await tx(async (t) => {
    await t('set local role app_user');
    out.visibleWithoutSetting = (await t('select count(*)::int n from sale')).rows[0].n;
  });
  out.pass = out.bRowsVisibleAsA === 0 && out.updateBAsA === 0 && out.insertIntoBAsA === 'rejected' && out.visibleWithoutSetting === 0 && (out.visibleAsA as number) > 0;
  return out;
}

const results: any = {};
{
  const { client, db } = await openPglite();
  await seedLoad(db, 1000);
  results.pglite = await checks(
    (s, p) => client.query(s, p as any[]).then((r) => ({ rows: r.rows, affected: r.affectedRows ?? 0 })),
    (fn) => client.transaction(async (tx) => fn((s, p) => tx.query(s, p as any[]).then((r) => ({ rows: r.rows, affected: r.affectedRows ?? 0 })))),
  );
  await client.close();
}
try {
  const { pool, db } = await openPostgres('spike_rls');
  await seedLoad(db, 1000);
  results.postgres = await checks(
    (s, p) => pool.query(s, p as any[]).then((r) => ({ rows: r.rows, affected: r.rowCount ?? 0 })),
    async (fn) => {
      const c = await pool.connect();
      try {
        await c.query('begin');
        await fn((s, p) => c.query(s, p as any[]).then((r) => ({ rows: r.rows, affected: r.rowCount ?? 0 })));
        await c.query('commit');
      } catch (e) {
        await c.query('rollback');
        throw e;
      } finally {
        c.release();
      }
    },
  );
  await pool.end();
} catch (e) {
  results.postgresError = String(e);
}
writeFileSync(new URL('./results/rls.json', import.meta.url), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
