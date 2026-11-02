import { PGlite } from '@electric-sql/pglite';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { fileURLToPath } from 'node:url';
import * as schema from './schema';

export type Schema = typeof schema;
/** A connection or a transaction: repositories accept either. */
export type Executor = PgDatabase<PgQueryResultHKT, Schema>;

export interface Database {
  readonly kind: 'pglite' | 'postgres';
  readonly db: Executor;
  /** Runs `fn` in one transaction; everything is rolled back if it throws. */
  transaction<T>(fn: (tx: Executor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export const migrationsFolder = fileURLToPath(new URL('../migrations', import.meta.url));

/**
 * Local database (PGlite). `dataDir` is a folder on disk; omit it for an in-memory database (tests, `pnpm dev`).
 * Migrations are applied on open.
 */
export async function connectPglite(options: { dataDir?: string; migrate?: boolean } = {}): Promise<Database> {
  const client = await PGlite.create(options.dataDir);
  const db = drizzlePglite(client, { schema });
  if (options.migrate !== false) await migratePglite(db, { migrationsFolder });
  return {
    kind: 'pglite',
    db: db as unknown as Executor,
    transaction: (fn) => db.transaction((tx) => fn(tx as unknown as Executor)),
    // PGlite runs one query at a time; closing while queries are still queued (e.g. the rest of a Promise.all
    // after one failed) can hang. A last trivial query waits for the queue to drain before closing.
    close: async () => {
      await client.query('select 1').catch(() => undefined);
      await client.close();
    },
  };
}

/** Managed Postgres (cloud, phase 5). Same schema and migrations. */
export async function connectPostgres(options: { url: string; migrate?: boolean; max?: number }): Promise<Database> {
  const pool = new pg.Pool({ connectionString: options.url, max: options.max ?? 10 });
  const db = drizzlePg(pool, { schema });
  if (options.migrate !== false) await migratePg(db, { migrationsFolder });
  return {
    kind: 'postgres',
    db: db as unknown as Executor,
    transaction: (fn) => db.transaction((tx) => fn(tx as unknown as Executor)),
    close: () => pool.end(),
  };
}
