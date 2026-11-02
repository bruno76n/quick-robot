// Opening the local data file (docs/02 §6 "Actualizaciones sin perder datos", docs/08 › Migraciones): if this build has
// migrations the file does not, the data folder is copied first; if a migration fails the copy is put back and the
// error says so. A folder that cannot be opened is reported as such (docs/15 §5).
import { PGlite } from '@electric-sql/pglite';
import { cp, mkdir, rename, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { connectPglite, DEFAULT_MIGRATIONS, schemaVersion, type Connection } from './connect';

export class DataUnreadableError extends Error { readonly code = 'DATA_UNREADABLE'; }
export class MigrationFailedError extends Error { readonly code = 'MIGRATION_FAILED'; constructor(message: string, readonly restored: boolean, readonly backupPath: string) { super(message); } }

export interface LocalOpen { conn: Connection; created: boolean; from: number; to: number; backupPath: string | null }

async function appliedMigrations(dir: string): Promise<number> {
  let client: PGlite;
  try { client = await PGlite.create(dir); } catch (e) { throw new DataUnreadableError(`cannot open data: ${(e as Error).message}`); }
  try {
    const r = await client.query<{ n: number }>(`select count(*)::int as n from drizzle.__drizzle_migrations`).catch(() => ({ rows: [{ n: 0 }] }));
    return r.rows[0]?.n ?? 0;
  } catch (e) {
    throw new DataUnreadableError(`cannot read data: ${(e as Error).message}`);
  } finally {
    await client.close().catch(() => undefined);
  }
}

export async function openLocalDatabase(dataDir: string, opts: { migrationsFolder?: string; now?: () => Date } = {}): Promise<LocalOpen> {
  const folder = opts.migrationsFolder ?? DEFAULT_MIGRATIONS;
  const pgdata = join(dataDir, 'pgdata');
  const to = schemaVersion(folder);
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  if (!existsSync(join(pgdata, 'PG_VERSION'))) {
    return { conn: await connectPglite({ dataDir: pgdata, migrationsFolder: folder }), created: true, from: 0, to, backupPath: null };
  }
  const from = await appliedMigrations(pgdata);
  if (from >= to) {
    try { return { conn: await connectPglite({ dataDir: pgdata, migrate: false }), created: false, from, to, backupPath: null }; } catch (e) { throw new DataUnreadableError((e as Error).message); }
  }
  const stamp = (opts.now?.() ?? new Date()).toISOString().replace(/[:.]/g, '-');
  const backupPath = join(dataDir, 'backups', `before-update-${stamp}`);
  await mkdir(join(dataDir, 'backups'), { recursive: true, mode: 0o700 });
  await cp(pgdata, backupPath, { recursive: true });
  try {
    return { conn: await connectPglite({ dataDir: pgdata, migrationsFolder: folder }), created: false, from, to, backupPath };
  } catch (e) {
    // Never leave the data half migrated: the copy goes back in place of the folder.
    const broken = `${pgdata}-failed-${stamp}`;
    await rename(pgdata, broken).catch(() => undefined);
    let restored = false;
    try { await cp(backupPath, pgdata, { recursive: true }); restored = true; await rm(broken, { recursive: true, force: true }); } catch { /* the copy stays in backups/ */ }
    throw new MigrationFailedError(`migration failed: ${(e as Error).message}`, restored, backupPath);
  }
}
