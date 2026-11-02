// Files in a folder on disk (userData). Keys are generated, never taken from the user, so there are
// no relative paths to escape the folder (docs/11 A05).
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { join, resolve, sep } from 'node:path';
import type { FileStore } from '../../deps';

const KEY = /^[0-9a-f-]{36}\/[0-9a-f]{32}$/;

export function diskFileStore(root: string): FileStore {
  const base = resolve(root);
  const pathOf = (key: string) => {
    if (!KEY.test(key)) throw new Error('Invalid file key');
    const p = resolve(base, key);
    if (!p.startsWith(base + sep)) throw new Error('Invalid file key');
    return p;
  };
  return {
    async put(ctx, file) {
      const key = `${ctx.workspaceId}/${randomBytes(16).toString('hex')}`;
      await mkdir(join(base, ctx.workspaceId), { recursive: true, mode: 0o700 });
      await writeFile(pathOf(key), file.bytes, { mode: 0o600 });
      return { key };
    },
    async read(ctx, ref) {
      if (!ref.key.startsWith(`${ctx.workspaceId}/`)) throw new Error('Invalid file key');
      return new Uint8Array(await readFile(pathOf(ref.key)));
    },
    async url(_ctx, ref) {
      return `/api/v1/files/${ref.key.split('/')[1]}`;
    },
    async delete(ctx, ref) {
      if (!ref.key.startsWith(`${ctx.workspaceId}/`)) return;
      await rm(pathOf(ref.key), { force: true });
    },
  };
}

/** In-memory store for tests. */
export function memoryFileStore(): FileStore & { size(): number } {
  const m = new Map<string, Uint8Array>();
  return {
    async put(ctx, file) { const key = `${ctx.workspaceId}/${randomBytes(16).toString('hex')}`; m.set(key, file.bytes); return { key }; },
    async read(ctx, ref) { const v = ref.key.startsWith(`${ctx.workspaceId}/`) ? m.get(ref.key) : undefined; if (!v) throw new Error('missing'); return v; },
    async url(_ctx, ref) { return `/api/v1/files/${ref.key.split('/')[1]}`; },
    async delete(ctx, ref) { if (ref.key.startsWith(`${ctx.workspaceId}/`)) m.delete(ref.key); },
    size: () => m.size,
  };
}
