// Row level security as a second barrier: a non-owner role sees only the workspace in app.workspace_id.
import { PGlite } from '@electric-sql/pglite';
import postgres from 'postgres';
import { writeFileSync } from 'node:fs';
import { PG_URL } from './db.ts';

const A = '00000000-0000-7000-8000-00000000000a', B = '00000000-0000-7000-8000-00000000000b';
const setup = `
  drop table if exists item; do $$ begin if exists (select 1 from pg_roles where rolname = 'app_user') then execute 'drop owned by app_user'; execute 'drop role app_user'; end if; end $$;
  create table item (workspace_id uuid not null, id serial primary key, name text);
  alter table item enable row level security; alter table item force row level security;
  create policy ws on item using (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
    with check (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);
  create role app_user nologin; grant usage on schema public to app_user; grant select, insert, update, delete on item to app_user; grant usage on sequence item_id_seq to app_user;
  insert into item (workspace_id, name) values ('${A}', 'a1'), ('${A}', 'a2'), ('${B}', 'b1');`;
type Q = (s: string) => Promise<any[]>;
async function check(q: Q) {
  const out: Record<string, unknown> = {};
  await q('begin'); await q('set local role app_user'); await q(`select set_config('app.workspace_id', '${A}', true)`);
  out.aSees = (await q('select name from item order by name')).map((r) => r.name);
  out.aUpdatesB = (await q(`update item set name = 'x' where workspace_id = '${B}' returning id`)).length;
  try { await q(`insert into item (workspace_id, name) values ('${B}', 'evil')`); out.aInsertsB = 'allowed'; } catch { out.aInsertsB = 'rejected'; }
  await q('rollback');
  await q('begin'); await q('set local role app_user');
  out.noSettingSees = (await q('select name from item')).length;
  await q('rollback');
  out.pass = JSON.stringify(out.aSees) === '["a1","a2"]' && out.aUpdatesB === 0 && out.aInsertsB === 'rejected' && out.noSettingSees === 0;
  return out;
}
const pgl = new PGlite(); await pgl.exec(setup);
const pgliteRes = await check(async (s) => (await pgl.query(s)).rows as any[]);
await pgl.close();
let pgRes: unknown = 'unavailable';
try {
  const sqlc = postgres(PG_URL, { max: 1, onnotice: () => {} });
  await sqlc.unsafe(setup);
  pgRes = await check(async (s) => [...(await sqlc.unsafe(s))]);
  await sqlc.unsafe('drop table item; drop owned by app_user; drop role app_user;'); await sqlc.end();
} catch (e) { pgRes = `unavailable: ${(e as Error).message}`; }
const res = { pglite: pgliteRes, postgres: pgRes };
console.log(JSON.stringify(res, null, 2));
writeFileSync(new URL('./results/rls.json', import.meta.url), JSON.stringify(res, null, 2));
if (!(pgliteRes as any).pass) process.exitCode = 1;
process.exit(process.exitCode ?? 0);
