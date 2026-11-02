// System and workspace (docs/12 §4).
import { getWorkspace } from '@app/db';
import { ok } from '../http';
import type { Router } from './router';

export function systemRoutes(r: Router) {
  r.get('/me', 'workspace.read', async (c) => {
    const s = c.get('session');
    const ws = await getWorkspace(c.get('deps').db, c.get('ctx'));
    return ok(c, { user: { id: s.userId }, workspace: { id: s.workspaceId, name: ws?.name ?? '' }, role: s.role });
  });
}
