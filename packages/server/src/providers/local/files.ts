import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { FileStore } from '../../deps';

/** Files in a folder on disk, one subfolder per workspace. */
export function createLocalFiles(root: string): FileStore {
  const base = resolve(root);
  const pathOf = (workspaceId: string, key: string) => {
    const p = resolve(base, workspaceId, key);
    if (!p.startsWith(base + sep)) throw new Error('Invalid file key');
    return p;
  };
  return {
    async put(ctx, file) {
      const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')).replace(/[^.\w]/g, '') : '';
      const key = `${randomUUID()}${ext}`;
      await mkdir(join(base, ctx.workspaceId), { recursive: true });
      await writeFile(pathOf(ctx.workspaceId, key), file.bytes);
      return { key };
    },
    async read(ctx, ref) {
      return new Uint8Array(await readFile(pathOf(ctx.workspaceId, ref.key)));
    },
    async url(_ctx, ref) {
      return `/api/v1/files/${encodeURIComponent(ref.key)}`;
    },
    async delete(ctx, ref) {
      await rm(pathOf(ctx.workspaceId, ref.key), { force: true });
    },
  };
}
