// The data folder seen from the shell, only for the fatal screens (docs/15 §5): list the automatic copies the server
// keeps in <data>/backups/<workspaceId>/backup-YYYY-MM-DD.json and put an unreadable data file aside (never deleted).
import { existsSync } from 'node:fs';
import { readdir, rename, stat } from 'node:fs/promises';
import { join } from 'node:path';

export interface BackupEntry { id: string; on: string; sizeKb: number; path: string }
const NAME = /^backup-(\d{4}-\d{2}-\d{2})\.json$/;
const WORKSPACE = /^[0-9a-f-]{36}$/i;

/** Newest first, at most `keep` (the server keeps 7). */
export async function listBackups(dataDir: string, keep = 7): Promise<BackupEntry[]> {
  const root = join(dataDir, 'backups');
  const out: BackupEntry[] = [];
  let folders: string[] = [];
  try { folders = (await readdir(root)).filter((f) => WORKSPACE.test(f)); } catch { return []; }
  for (const ws of folders) {
    let files: string[] = [];
    try { files = await readdir(join(root, ws)); } catch { continue; }
    for (const f of files) {
      const m = NAME.exec(f);
      if (!m) continue;
      const path = join(root, ws, f);
      out.push({ id: m[1]!, on: m[1]!, sizeKb: Math.ceil((await stat(path)).size / 1024), path });
    }
  }
  return out.sort((a, b) => b.on.localeCompare(a.on)).slice(0, keep);
}

export const stampOf = (d: Date) => d.toISOString().replace(/[:.]/g, '-');

/** Moves <data>/pgdata to <data>/pgdata-<label>-<stamp> and returns the new path (null when there was none). */
export async function moveDataAside(dataDir: string, label: string, now: Date): Promise<string | null> {
  const pgdata = join(dataDir, 'pgdata');
  if (!existsSync(pgdata)) return null;
  const target = join(dataDir, `pgdata-${label}-${stampOf(now)}`);
  await rename(pgdata, target);
  return target;
}
