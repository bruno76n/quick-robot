import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { ExtractTablesWithRelations } from 'drizzle-orm';

export type Db = PgDatabase<PgQueryResultHKT, Record<string, never>, ExtractTablesWithRelations<Record<string, never>>>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
/** Anything that can run a query: the database or an open transaction. */
export type Executor = Db | Tx;

/** One business operation = one transaction (CLAUDE.md rule 5). */
export function transaction<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(fn);
}
