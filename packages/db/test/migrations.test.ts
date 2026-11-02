// The same migrations run on PGlite and on a regular Postgres (docs/02 §4, criterion 1). Postgres part needs PG_URL.
import { describe, expect, it } from 'vitest';
import pg from 'pg';
import { connectPglite, connectPostgres } from '../src';

const tables = ['filament', 'membership', 'spool', 'spool_movement', 'user', 'workspace'];
const listTables = `select table_name from information_schema.tables where table_schema = 'public' order by 1`;

describe('migrations', () => {
  it('apply on PGlite', async () => {
    const database = await connectPglite();
    const res = await database.db.execute(listTables as never);
    await database.close();
    expect((res as unknown as { rows: { table_name: string }[] }).rows.map((r) => r.table_name)).toEqual(tables);
  });

  it.skipIf(!process.env.PG_URL)('apply unchanged on Postgres', async () => {
    const url = process.env.PG_URL!;
    const admin = new pg.Client({ connectionString: url });
    await admin.connect();
    await admin.query('drop database if exists app_migrations_test');
    await admin.query('create database app_migrations_test');
    await admin.end();
    const database = await connectPostgres({ url: url.replace(/\/[^/]*$/, '/app_migrations_test') });
    const res = await database.db.execute(listTables as never);
    await database.close();
    expect((res as unknown as { rows: { table_name: string }[] }).rows.map((r) => r.table_name)).toEqual(tables);
  });
});
