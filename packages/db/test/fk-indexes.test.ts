// Every foreign key has an index that starts with its columns (docs/05 › Índices que importan): without it, deleting
// a parent scans the whole child table (a restore of 25 000 sales went from minutes to seconds with these indexes).
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { Connection } from '../src/connect';
import { openTestDb } from '../src/testing';

let conn: Connection;
beforeAll(async () => { conn = await openTestDb(); });
afterAll(() => conn.close());

it('every foreign key is covered by an index', async () => {
  const r = await conn.db.execute(sql`
    select c.conrelid::regclass::text as tbl, c.conname, (select array_agg(a.attname order by k.ord) from unnest(c.conkey) with ordinality k(attnum, ord) join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as cols
    from pg_constraint c where c.contype = 'f' and c.connamespace = 'public'::regnamespace
      and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] = c.conkey)`);
  const missing = (r as unknown as { rows: { tbl: string; conname: string; cols: string[] }[] }).rows.map((x) => `${x.tbl}(${x.cols.join(', ')})`).sort();
  expect(missing).toEqual([]);
});
