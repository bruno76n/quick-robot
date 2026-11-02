import { Hono } from 'hono';
import type { AppDeps } from '../deps';
import type { AppEnv } from '../env';
import { MAX_IMAGE_BYTES, readFile, uploadImage } from '../usecases/files';
import { BusinessError } from '@app/contract';

/** POST /files with the raw image as body (Content-Type = image mime). GET /files/:id serves it. */
export function fileRoutes(deps: AppDeps) {
  return new Hono<AppEnv>()
    .post('/', async (c) => {
      const len = Number(c.req.header('content-length') ?? 0);
      if (len > MAX_IMAGE_BYTES) throw new BusinessError('FILE_TOO_LARGE');
      const bytes = new Uint8Array(await c.req.arrayBuffer());
      return c.json(await uploadImage(deps, c.get('ctx'), { mime: (c.req.header('content-type') ?? '').split(';')[0]!.trim(), bytes }), 201);
    })
    .get('/:id', async (c) => {
      const f = await readFile(deps, c.get('ctx'), c.req.param('id'));
      return c.body(f.bytes as unknown as ArrayBuffer, 200, { 'content-type': f.mime, 'cache-control': 'private, max-age=31536000, immutable', 'x-content-type-options': 'nosniff', 'content-disposition': 'inline' });
    });
}
