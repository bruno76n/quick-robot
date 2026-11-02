// Upload of a product photo through the injected FileStore (disk locally, object storage in the cloud).
import { BusinessError } from '@app/contract';
import { fileRepo, type Ctx } from '@app/db';
import type { AppDeps } from '../deps';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' };

export async function uploadImage(deps: AppDeps, ctx: Ctx, file: { mime: string; bytes: Uint8Array }): Promise<{ id: string; url: string }> {
  const ext = IMAGE_TYPES[file.mime];
  if (!ext) throw new BusinessError('UNSUPPORTED_FILE');
  if (file.bytes.byteLength > MAX_IMAGE_BYTES) throw new BusinessError('FILE_TOO_LARGE', 'Max 2 MB', { maxBytes: MAX_IMAGE_BYTES });
  await deps.entitlements.assert(ctx, 'files.upload', file.bytes.byteLength);
  const ref = await deps.files.put(ctx, { name: `photo${ext}`, mime: file.mime, bytes: file.bytes });
  const row = await deps.database.transaction((tx) => fileRepo.insert(tx, ctx, { kind: 'product_photo', mime: file.mime, size: file.bytes.byteLength, storageKey: ref.key }));
  return { id: row.id, url: `/api/v1/files/${row.id}` };
}

export async function readFile(deps: AppDeps, ctx: Ctx, id: string): Promise<{ mime: string; bytes: Uint8Array }> {
  const row = await fileRepo.get(deps.database.db, ctx, id);
  if (!row) throw new BusinessError('NOT_FOUND', 'File not found');
  return { mime: row.mime, bytes: await deps.files.read(ctx, { key: row.storageKey }) };
}
