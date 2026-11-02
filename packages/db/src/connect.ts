// Connections (docs/02 §4): PGlite on the Mac, Postgres in the cloud. Same schema and migrations.
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { fileURLToPath } from 'node:url';
import type { Db } from './db';

export const DEFAULT_MIGRATIONS = fileURLToPath(new URL('../migrations', import.meta.url));

export interface Connection {
  db: Db;
  kind: 'pglite' | 'postgres';
  close(): Promise<void>;
  /** PGlite only: a copy of the whole data directory (tests, backups). */
  dump?: () => Promise<Blob>;
}

export interface PgliteOptions {
  dataDir?: string;
  loadDataDir?: Blob;
  migrationsFolder?: string;
  migrate?: boolean;
}

export async function connectPglite(opts: PgliteOptions = {}): Promise<Connection> {
  const client = await PGlite.create(opts.dataDir, opts.loadDataDir ? { loadDataDir: opts.loadDataDir } : {});
  const db = drizzlePglite(client) as unknown as Db;
  if (opts.migrate !== false) await migratePglite(drizzlePglite(client), { migrationsFolder: opts.migrationsFolder ?? DEFAULT_MIGRATIONS });
  return {
    db,
    kind: 'pglite',
    async close() {
      // Let queued queries finish first: closing with work in the queue can hang.
      await client.query('select 1').catch(() => undefined);
      await client.close();
    },
    dump: () => client.dumpDataDir('none') as Promise<Blob>,
  };
}

export async function connectPostgres(url: string, opts: { migrationsFolder?: string; max?: number } = {}): Promise<Connection> {
  const client = postgres(url, { max: opts.max ?? 10, onnotice: () => undefined });
  const db = drizzlePostgres(client) as unknown as Db;
  await migratePostgres(drizzlePostgres(client), { migrationsFolder: opts.migrationsFolder ?? DEFAULT_MIGRATIONS });
  return { db, kind: 'postgres', close: () => client.end() };
}
