// The same migrations apply to PGlite and to Postgres without changes (docs/02 §4 criterion 1).
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { connectPglite, connectPostgres } from '../src/connect';
import { PG_URL } from '../src/testing';

describe('migrations', () => {
  it('apply on a fresh PGlite and create the spool_levels view', async () => {
    const c = await connectPglite();
    const r = (await c.db.execute(sql`select count(*)::int as n from spool_levels`)) as unknown as { rows: { n: number }[] };
    expect(r.rows[0]?.n).toBe(0);
    await c.close();
  }, 60_000);

  it.runIf(PG_URL)('apply on Postgres', async () => {
    const c = await connectPostgres(PG_URL!, { max: 1 });
    const r = (await c.db.execute(sql`select count(*)::int as n from information_schema.views where table_name = 'spool_levels'`)) as unknown as { n: number }[];
    await c.close();
    expect(r[0]?.n).toBe(1);
  }, 60_000);
});
