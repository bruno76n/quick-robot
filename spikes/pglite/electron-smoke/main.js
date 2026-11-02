// Smoke test: PGlite inside a packaged (asar) Electron app. Opens a file DB in userData, migrates, writes, reads, quits.
import { app } from 'electron';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = process.env.SMOKE_OUT ?? join(app.getPath('temp'), 'pglite-smoke.json');
app.whenReady().then(async () => {
  const result = { electron: process.versions.electron, node: process.versions.node, asar: import.meta.url.includes('.asar') };
  try {
    const dataDir = join(app.getPath('userData'), 'pgdata');
    const t0 = Date.now();
    const db = await PGlite.create(dataDir);
    result.openMs = Date.now() - t0;
    const sql = readFileSync(new URL('./migration.sql', import.meta.url), 'utf8');
    await db.exec(sql);
    await db.query(`insert into smoke (note) values ($1)`, [`run at ${new Date().toISOString()}`]);
    result.rows = (await db.query('select count(*)::int n from smoke')).rows[0].n;
    result.version = (await db.query('select version() v')).rows[0].v;
    await db.close();
    result.dataDir = dataDir;
    result.pass = result.rows > 0;
  } catch (e) {
    result.pass = false;
    result.error = String(e?.stack ?? e);
  }
  writeFileSync(out, JSON.stringify(result, null, 2));
  app.quit();
});
