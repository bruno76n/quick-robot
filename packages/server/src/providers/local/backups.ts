// Automatic backups (docs/08 BackupStore): one per day in backups/ next to the data, last 7 kept.
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Ctx } from '@app/db';
import type { BackupInfo, BackupStore, Clock } from '../../deps';

const NAME = /^backup-(\d{4}-\d{2}-\d{2})\.json$/;
export const KEEP_BACKUPS = 7;

export function folderBackupStore(root: string, clock: Clock, keep = KEEP_BACKUPS): BackupStore {
  // One folder per business: a backup id of another business is never found (docs/11 A01).
  const folder = (ctx: Ctx) => { if (!/^[0-9a-f-]{36}$/i.test(ctx.workspaceId)) throw new Error('Invalid workspace'); return join(root, ctx.workspaceId); };
  const list = async (ctx: Ctx): Promise<BackupInfo[]> => {
    const dir = folder(ctx);
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
    list: async (ctx) => list(ctx),
    async create(ctx, data) {
      const dir = folder(ctx);
      await mkdir(dir, { recursive: true, mode: 0o700 });
      const on = clock.today();
      await writeFile(join(dir, `backup-${on}.json`), data, { mode: 0o600 });
      const all = await list(ctx);
      for (const old of all.slice(keep)) await rm(join(dir, `backup-${old.on}.json`), { force: true });
      return all.find((b) => b.on === on)!;
    },
    async read(ctx, id) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(id)) throw new Error('Invalid backup id');
      return new Uint8Array(await readFile(join(folder(ctx), `backup-${id}.json`)));
    },
  };
}

export function memoryBackupStore(clock: Clock): BackupStore {
  const all = new Map<string, Map<string, Uint8Array>>();
  const of = (c: Ctx) => { let m = all.get(c.workspaceId); if (!m) { m = new Map(); all.set(c.workspaceId, m); } return m; };
  return {
    async list(c) { return [...of(c).entries()].map(([on, d]) => ({ id: on, on, sizeKb: Math.ceil(d.length / 1024) })).sort((a, b) => b.on.localeCompare(a.on)); },
    async create(c, data) { const on = clock.today(); of(c).set(on, data); return { id: on, on, sizeKb: Math.ceil(data.length / 1024) }; },
    async read(c, id) { const d = of(c).get(id); if (!d) throw new Error('missing'); return d; },
  };
}
