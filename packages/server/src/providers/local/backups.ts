// Automatic backups (docs/08 BackupStore): one per day in backups/ next to the data, last 7 kept.
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { BackupInfo, BackupStore, Clock } from '../../deps';

const NAME = /^backup-(\d{4}-\d{2}-\d{2})\.json$/;
export const KEEP_BACKUPS = 7;

export function folderBackupStore(dir: string, clock: Clock, keep = KEEP_BACKUPS): BackupStore {
  const list = async (): Promise<BackupInfo[]> => {
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const out: BackupInfo[] = [];
    for (const f of await readdir(dir)) {
      const m = NAME.exec(f);
      if (!m) continue;
      out.push({ id: m[1]!, on: m[1]!, sizeKb: Math.ceil((await stat(join(dir, f))).size / 1024) });
    }
    return out.sort((a, b) => b.on.localeCompare(a.on));
  };
  return {
    list: async () => list(),
    async create(_ctx, data) {
      await mkdir(dir, { recursive: true, mode: 0o700 });
      const on = clock.today();
      await writeFile(join(dir, `backup-${on}.json`), data, { mode: 0o600 });
      const all = await list();
      for (const old of all.slice(keep)) await rm(join(dir, `backup-${old.on}.json`), { force: true });
      return all.find((b) => b.on === on)!;
    },
    async read(_ctx, id) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(id)) throw new Error('Invalid backup id');
      return new Uint8Array(await readFile(join(dir, `backup-${id}.json`)));
    },
  };
}

export function memoryBackupStore(clock: Clock): BackupStore {
  const m = new Map<string, Uint8Array>();
  return {
    async list() { return [...m.entries()].map(([on, d]) => ({ id: on, on, sizeKb: Math.ceil(d.length / 1024) })).sort((a, b) => b.on.localeCompare(a.on)); },
    async create(_c, data) { const on = clock.today(); m.set(on, data); return { id: on, on, sizeKb: Math.ceil(data.length / 1024) }; },
    async read(_c, id) { const d = m.get(id); if (!d) throw new Error('missing'); return d; },
  };
}
