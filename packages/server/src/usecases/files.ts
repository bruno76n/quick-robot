// Uploaded images (docs/12 §10, docs/15 §4): only JPG, PNG or WebP checked by their signature, size limited,
// stored in the FileStore and served with nosniff. The browser shrinks them before upload.
import { BusinessError } from '@app/contract';
import { getFile, insertFile, transaction, type Ctx } from '@app/db';
import type { Deps } from '../deps';
import { notFound } from '../http';

export const IMAGE_LIMIT_MB = { product_photo: 12, print_photo: 12, customer_logo: 8 } as const;
export type FileKind = keyof typeof IMAGE_LIMIT_MB;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

/** The real type from the first bytes; what the client says is not trusted. */
export function sniffImage(b: Uint8Array): string | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => b[i] === x)) return 'image/png';
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

export async function uploadFile(deps: Deps, ctx: Ctx, kind: FileKind, bytes: Uint8Array) {
  const maxMb = IMAGE_LIMIT_MB[kind];
  if (bytes.length > maxMb * 1024 * 1024) throw new BusinessError('FILE_TOO_LARGE', { maxMb });
  const mime = sniffImage(bytes);
  if (!mime) throw new BusinessError('UNSUPPORTED_IMAGE', { accepted: ['JPG', 'PNG', 'WebP'] });
  const ref = await deps.files.put(ctx, { kind, mime, bytes });
  try {
    return await transaction(deps.db, async (tx) => {
      const row = await insertFile(tx, ctx, { id: deps.ids.next(), kind, mime, size: bytes.length, storageKey: ref.key });
      return { fileId: row.id, url: `/api/v1/files/${row.id}` };
    });
  } catch (e) {
    await deps.files.delete(ctx, ref);
    throw e;
  }
}

export async function readFile(deps: Deps, ctx: Ctx, id: string) {
  const row = await getFile(deps.db, ctx, id);
  if (!row || !ACCEPTED.includes(row.mime)) throw notFound('file');
  return { mime: row.mime, bytes: await deps.files.read(ctx, { key: row.storageKey }) };
}

