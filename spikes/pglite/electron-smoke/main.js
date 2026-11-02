// Opens PGlite in userData, creates a table, inserts a row, prints the count and quits.
import { app } from 'electron';
import { PGlite } from '@electric-sql/pglite';
import { join } from 'node:path';

app.whenReady().then(async () => {
  const t0 = Date.now();
  try {
    const db = new PGlite(join(app.getPath('userData'), 'pgdata'));
    await db.waitReady;
    await db.exec('create table if not exists smoke (id serial primary key, at timestamptz default now())');
    await db.query('insert into smoke default values');
    const r = await db.query('select count(*)::int as n from smoke');
    await db.close();
    console.log(JSON.stringify({ ok: true, rows: r.rows[0].n, ms: Date.now() - t0, userData: app.getPath('userData') }));
  } catch (e) {
    console.log(JSON.stringify({ ok: false, error: String(e) }));
  }
  app.exit(0);
});
