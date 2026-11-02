import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { AppDeps } from '../deps';
import type { AppEnv } from '../env';
import { guard } from '../middleware/guard';
import { MAX_IMAGE_BYTES, readFile, uploadImage } from '../usecases/files';
import { BusinessError } from '@app/contract';

/** POST /files with the raw image as body (Content-Type = image mime). GET /files/:id serves it. */
export function fileRoutes(deps: AppDeps) {
  return new Hono<AppEnv>()
    .post(
      '/',
      guard('files.write'),
      bodyLimit({
        maxSize: MAX_IMAGE_BYTES,
        onError: () => {
          throw new BusinessError('FILE_TOO_LARGE');
        },
      }),
      async (c) => {
      const bytes = new Uint8Array(await c.req.arrayBuffer());
      return c.json(await uploadImage(deps, c.get('ctx'), { mime: (c.req.header('content-type') ?? '').split(';')[0]!.trim(), bytes }), 201);
      },
    )
    .get('/:id', guard('files.read'), async (c) => {
      const f = await readFile(deps, c.get('ctx'), c.req.param('id'));
      return c.body(f.bytes as unknown as ArrayBuffer, 200, { 'content-type': f.mime, 'cache-control': 'private, max-age=31536000, immutable', 'x-content-type-options': 'nosniff', 'content-disposition': 'inline', 'content-security-policy': "default-src 'none'; sandbox" });
    });
}
