// Filaments and spools (docs/12 §8).
import { addSpoolInput, finishSpoolInput, pageQuery, spoolMovementInput, updateSpoolInput, weighSpoolInput } from '@app/contract';
import { getFilament, listFilaments, listSpoolMovements } from '@app/db';
import { body, idParam, notFound, ok, optionalBody, query } from '../http';
import { deleteSpool, finishSpool, recordSpoolMovement, restoreSpool, updateSpool, weighSpool } from '../usecases/spools';
import { addSpool } from '../usecases/add-spool';
import { filamentDetailView, filamentListItems, loadFilamentData } from '../views/filament-view';
import type { Router } from './router';

export function filamentRoutes(r: Router) {
  r.get('/filaments', 'filament.read', async (c) => {
    const { db } = c.get('deps');
    const ctx = c.get('ctx');
    const q = query(c, pageQuery);
    const { items, total } = await listFilaments(db, ctx, q);
    return ok(c, { items: await filamentListItems(db, ctx, items), page: q.page, pageSize: q.pageSize, total });
  });

  r.get('/filaments/:id', 'filament.read', async (c) => {
    const { db } = c.get('deps');
    const ctx = c.get('ctx');
    const f = await getFilament(db, ctx, idParam(c, 'id', 'filament'));
    if (!f) throw notFound('filament');
    const data = await loadFilamentData(db, ctx);
    return ok(c, filamentDetailView(f, data.spoolsOf(f.id), await listSpoolMovements(db, ctx, f.id), data.costs));
  });

  r.post('/spools', 'spool.create', async (c) => {
    return ok(c, await addSpool(c.get('deps'), c.get('ctx'), await body(c, addSpoolInput)), 201);
  });
  r.patch('/spools/:id', 'spool.update', async (c) => ok(c, await updateSpool(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'spool'), await body(c, updateSpoolInput))));
  r.delete('/spools/:id', 'spool.delete', async (c) => ok(c, await deleteSpool(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'spool'))));
  r.post('/spools/:id/restore', 'spool.delete', async (c) => ok(c, await restoreSpool(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'spool'))));
  r.post('/spools/:id/movements', 'spool.movement', async (c) => ok(c, await recordSpoolMovement(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'spool'), await body(c, spoolMovementInput)), 201));
  r.post('/spools/:id/finish', 'spool.movement', async (c) => ok(c, await finishSpool(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'spool'), await optionalBody(c, finishSpoolInput))));
  r.post('/spools/:id/weigh', 'spool.movement', async (c) => ok(c, await weighSpool(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'spool'), await body(c, weighSpoolInput))));
}
