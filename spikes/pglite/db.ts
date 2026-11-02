import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { fileURLToPath } from 'node:url';
import * as schema from './schema.ts';

export const migrationsFolder = fileURLToPath(new URL('./migrations', import.meta.url));

export async function openPglite(dataDir?: string) {
  const client = await PGlite.create(dataDir);
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder });
  return { client, db };
}

export const PG_URL = process.env.PG_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/postgres';

export async function openPostgres(database: string) {
  const admin = new pg.Client({ connectionString: PG_URL });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${database}`);
  await admin.query(`CREATE DATABASE ${database}`);
  await admin.end();
  const pool = new pg.Pool({ connectionString: PG_URL.replace(/\/[^/]*$/, `/${database}`) });
  const db = drizzlePg(pool, { schema });
  await migratePg(db, { migrationsFolder });
  return { pool, db };
}
