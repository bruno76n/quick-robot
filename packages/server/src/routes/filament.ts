// Filaments and spools (docs/12 §8).
import { addSpoolInput, pageQuery } from '@app/contract';
import { getFilament, listFilaments, listSpoolMovements, listSpools } from '@app/db';
import { body, idParam, notFound, ok, query } from '../http';
import { addSpool } from '../usecases/add-spool';
import { filamentDetailView, filamentListItems } from '../views/filament-view';
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
    return ok(c, filamentDetailView(f, await listSpools(db, ctx, [f.id]), await listSpoolMovements(db, ctx, f.id)));
  });

  r.post('/spools', 'spool.create', async (c) => {
    return ok(c, await addSpool(c.get('deps'), c.get('ctx'), await body(c, addSpoolInput)), 201);
  });
}
