// Updating the app keeps the data: pending migrations run after a copy; a failing one puts the copy back (docs/02 §6).
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULT_MIGRATIONS, schemaVersion } from '../src/connect';
import { DataUnreadableError, MigrationFailedError, openLocalDatabase } from '../src/migrate-local';

const tmp: string[] = [];
const dir = (p: string) => { const d = mkdtempSync(join(tmpdir(), p)); tmp.push(d); return d; };
afterAll(() => { for (const d of tmp) rmSync(d, { recursive: true, force: true }); });

/** A copy of the migrations folder without its last migration (the "previous version" of the app), or with an extra one. */
function migrations(opts: { dropLast?: boolean; extra?: string }) {
  const out = dir('mig-');
  cpSync(DEFAULT_MIGRATIONS, out, { recursive: true });
  const journalPath = join(out, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: { idx: number; tag: string; when: number; breakpoints: boolean; version: string }[] };
  if (opts.dropLast) { const last = journal.entries.pop()!; rmSync(join(out, `${last.tag}.sql`)); }
  if (opts.extra) {
    const prev = journal.entries.at(-1)!;
    const tag = `${String(prev.idx + 1).padStart(4, '0')}_extra`;
    journal.entries.push({ ...prev, idx: prev.idx + 1, tag, when: prev.when + 1000 });
    writeFileSync(join(out, `${tag}.sql`), opts.extra);
  }
  writeFileSync(journalPath, JSON.stringify(journal));
  return out;
}
const count = async (conn: Awaited<ReturnType<typeof openLocalDatabase>>['conn']) => Number(((await conn.db.execute(sql`select count(*)::int as n from workspace`)) as unknown as { rows: { n: number }[] }).rows[0]!.n);

describe('local data file', () => {
  it('a new folder is created and migrated; opening again migrates nothing', async () => {
    const data = dir('data-');
    const a = await openLocalDatabase(data);
    expect([a.created, a.to, a.backupPath]).toEqual([true, schemaVersion(), null]);
    await a.conn.close();
    const b = await openLocalDatabase(data);
    expect([b.created, b.from, b.backupPath]).toEqual([false, schemaVersion(), null]);
    await b.conn.close();
  }, 60_000);

  it('an update with a new migration copies the folder first and keeps the data', async () => {
    const data = dir('data-');
    const old = await openLocalDatabase(data, { migrationsFolder: migrations({ dropLast: true }) });
    await old.conn.db.execute(sql`insert into workspace (id, name) values ('0190aaaa-0000-7000-8000-000000000001', 'Taller')`);
    await old.conn.close();
    const now = await openLocalDatabase(data);
    expect(now.from).toBe(schemaVersion() - 1);
    expect(now.backupPath && existsSync(join(now.backupPath, 'PG_VERSION'))).toBe(true);
    expect(await count(now.conn)).toBe(1);
    await now.conn.close();
  }, 90_000);

  it('a migration that fails restores the copy: same data, previous version, and the app can open it again', async () => {
    const data = dir('data-');
    const a = await openLocalDatabase(data);
    await a.conn.db.execute(sql`insert into workspace (id, name) values ('0190aaaa-0000-7000-8000-000000000002', 'Taller')`);
    await a.conn.close();
    const bad = migrations({ extra: 'create table broken (id int);\n--> statement-breakpoint\nthis is not sql;' });
    await expect(openLocalDatabase(data, { migrationsFolder: bad })).rejects.toBeInstanceOf(MigrationFailedError);
    expect(readdirSync(data).filter((f) => f.startsWith('pgdata-failed'))).toEqual([]);
    const again = await openLocalDatabase(data);
    expect([again.from, await count(again.conn)]).toEqual([schemaVersion(), 1]);
    expect(((await again.conn.db.execute(sql`select to_regclass('broken') as t`)) as unknown as { rows: { t: string | null }[] }).rows[0]!.t).toBeNull();
    await again.conn.close();
  }, 90_000);

  it('a folder that cannot be read is reported as unreadable', async () => {
    const data = dir('data-');
    const a = await openLocalDatabase(data);
    await a.conn.close();
    writeFileSync(join(data, 'pgdata', 'PG_VERSION'), 'garbage');
    rmSync(join(data, 'pgdata', 'global'), { recursive: true, force: true });
    await expect(openLocalDatabase(data)).rejects.toBeInstanceOf(DataUnreadableError);
  }, 60_000);
});
