import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import postgres from 'postgres';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import { migrate as migratePg } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'node:url';

export const migrationsFolder = fileURLToPath(new URL('./migrations', import.meta.url));
export const PG_URL = process.env.PG_URL ?? 'postgres://qr:qr@127.0.0.1:5432/qr_spike';

export async function openPglite(dataDir?: string) {
  const client = new PGlite(dataDir);
  await client.waitReady;
  const db = drizzlePglite(client);
  await migratePglite(db, { migrationsFolder });
  return { db, client, close: () => client.close() };
}

export async function openPostgres(url = PG_URL) {
  const client = postgres(url, { max: 4, onnotice: () => {} });
  await client.unsafe('drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;');
  const db = drizzlePg(client);
  await migratePg(db, { migrationsFolder });
  return { db, client, close: () => client.end() };
}
