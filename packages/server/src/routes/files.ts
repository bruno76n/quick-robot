// Uploads (docs/12 §10): multipart with `kind` and `file`; served inline with nosniff and an isolating CSP.
import { BusinessError, fileKind } from '@app/contract';
import { idParam, ok, parse } from '../http';
import { readFile, uploadFile } from '../usecases/files';
import type { Router } from './router';

export function fileRoutes(r: Router) {
  r.post('/files', 'file.upload', async (c) => {
    let form: FormData;
    try { form = await c.req.formData(); } catch { throw new BusinessError('UNSUPPORTED_IMAGE', { accepted: ['JPG', 'PNG', 'WebP'] }); }
    const kind = parse(fileKind, form.get('kind'));
    const file = form.get('file');
    if (!(file instanceof Blob)) throw new BusinessError('VALIDATION_ERROR', { fields: [{ path: 'file', rule: 'required' }] });
    return ok(c, await uploadFile(c.get('deps'), c.get('ctx'), kind, new Uint8Array(await file.arrayBuffer())), 201);
  });
  r.get('/files/:id', 'file.read', async (c) => {
    const f = await readFile(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'file'));
    return c.body(f.bytes as unknown as ArrayBuffer, 200, {
      'Content-Type': f.mime, 'Content-Disposition': 'inline', 'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=31536000, immutable', 'Content-Security-Policy': "default-src 'none'; sandbox",
    });
  });
}
