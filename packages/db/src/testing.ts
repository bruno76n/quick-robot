// Test helpers: a migrated PGlite is created once per run and every test file loads a copy of it
// (initdb inside WASM takes ~5 s; loading a dump takes ~0.6 s).
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connectPglite, DEFAULT_MIGRATIONS, type Connection } from './connect';

function migrationsHash(folder: string): string {
  const h = createHash('sha256');
  for (const f of readdirSync(folder).filter((x) => x.endsWith('.sql')).sort()) h.update(f).update(readFileSync(join(folder, f)));
  return h.digest('hex').slice(0, 16);
}

export async function openTestDb(): Promise<Connection> {
  const dir = join(tmpdir(), 'app-test-db');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${migrationsHash(DEFAULT_MIGRATIONS)}.tar`);
  if (!existsSync(file)) {
    const fresh = await connectPglite();
    const blob = await fresh.dump!();
    await fresh.close();
    const tmp = `${file}.${process.pid}.${Date.now()}`;
    writeFileSync(tmp, Buffer.from(await blob.arrayBuffer()));
    renameSync(tmp, file);
  }
  return connectPglite({ loadDataDir: new Blob([readFileSync(file)]), migrate: false });
}

export const PG_URL = process.env.PG_URL;
