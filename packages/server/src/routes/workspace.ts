// Export, import, automatic backups, restore and "Vaciar negocio" (docs/12 §10).
import { BusinessError } from '@app/contract';
import { getSettings } from '@app/db';
import { z } from 'zod';
import { body, ok } from '../http';
import { clearWorkspace, createBackup, exportWorkspace, importWorkspace, restoreBackup } from '../usecases/workspace-data';
import type { Router } from './router';

const confirmBody = z.object({ confirm: z.boolean().optional() });
const BACKUP_ID = /^\d{4}-\d{2}-\d{2}$/;
/** File name from the business name in Ajustes (never from code) and the date. */
const fileName = (name: string, today: string) => `${(name || 'negocio').normalize('NFD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'negocio'}-${today}.json`;

export function workspaceRoutes(r: Router) {
  r.get('/workspace/export', 'workspace.export', async (c) => {
    const deps = c.get('deps');
    const ctx = c.get('ctx');
    const data = await exportWorkspace(deps, ctx);
    const name = (await getSettings(deps.db, ctx))?.business.name ?? '';
    return c.body(JSON.stringify(data), 200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="${fileName(name, deps.clock.today())}"`, 'Cache-Control': 'no-store' });
  });
  r.post('/workspace/import', 'workspace.import', async (c) => {
    let form: FormData;
    try { form = await c.req.formData(); } catch { throw new BusinessError('IMPORT_INVALID_FILE', { reason: 'form' }); }
    const file = form.get('file');
    if (!(file instanceof Blob)) throw new BusinessError('VALIDATION_ERROR', { fields: [{ path: 'file', rule: 'required' }] });
    if (file.size > c.get('deps').importLimitMb * 1024 * 1024) throw new BusinessError('FILE_TOO_LARGE', { maxMb: c.get('deps').importLimitMb });
    return ok(c, await importWorkspace(c.get('deps'), c.get('ctx'), new Uint8Array(await file.arrayBuffer()), { confirm: form.get('confirm') === 'true' }));
  });
  r.post('/workspace/clear', 'workspace.clear', async (c) => ok(c, await clearWorkspace(c.get('deps'), c.get('ctx'), { confirm: (await body(c, confirmBody)).confirm === true })));
  r.get('/backups', 'backup.read', async (c) => ok(c, await c.get('deps').backups.list(c.get('ctx'))));
  r.post('/backups', 'backup.create', async (c) => ok(c, await createBackup(c.get('deps'), c.get('ctx')), 201));
  r.post('/backups/:id/restore', 'workspace.import', async (c) => {
    const id = c.req.param('id') ?? '';
    if (!BACKUP_ID.test(id)) throw new BusinessError('NOT_FOUND', { entity: 'backup' });
    return ok(c, await restoreBackup(c.get('deps'), c.get('ctx'), id, { confirm: (await body(c, confirmBody)).confirm === true }));
  });
}
