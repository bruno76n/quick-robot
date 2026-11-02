import { Hono } from 'hono';
import type { AppDeps } from '../deps';
import type { AppEnv } from '../env';
import { getCollection, getProduct, listCatalogue } from '../queries/catalogue';
import { loadCostingContext } from '../queries/costing';
import { deleteCollection, deleteProduct, saveCollection, saveProduct, saveProductAsVariant, setProductPhoto } from '../usecases/products';
import { body } from './body';

export function productRoutes(deps: AppDeps) {
  return new Hono<AppEnv>()
    .get('/', async (c) => c.json(await listCatalogue(deps.database.db, c.get('ctx'))))
    .get('/costing-context', async (c) => c.json((await loadCostingContext(deps.database.db, c.get('ctx'))).dto))
    .post('/', async (c) => c.json(await saveProduct(deps, c.get('ctx'), null, await body(c)), 201))
    .get('/:id', async (c) => c.json(await getProduct(deps.database.db, c.get('ctx'), c.req.param('id'))))
    .put('/:id', async (c) => c.json(await saveProduct(deps, c.get('ctx'), c.req.param('id'), await body(c))))
    .post('/:id/variants', async (c) => c.json(await saveProductAsVariant(deps, c.get('ctx'), c.req.param('id'), await body(c)), 201))
    .put('/:id/photo', async (c) => {
      const b = (await body(c)) as { fileId?: unknown };
      return c.json(await setProductPhoto(deps, c.get('ctx'), c.req.param('id'), typeof b.fileId === 'string' ? b.fileId : null));
    })
    .delete('/:id', async (c) => (await deleteProduct(deps, c.get('ctx'), c.req.param('id')), c.body(null, 204)))
    .post('/:id/restore', async (c) => (await deleteProduct(deps, c.get('ctx'), c.req.param('id'), true), c.body(null, 204)));
}

export function collectionRoutes(deps: AppDeps) {
  return new Hono<AppEnv>()
    .post('/', async (c) => c.json(await saveCollection(deps, c.get('ctx'), null, await body(c)), 201))
    .get('/:id', async (c) => c.json(await getCollection(deps.database.db, c.get('ctx'), c.req.param('id'))))
    .put('/:id', async (c) => c.json(await saveCollection(deps, c.get('ctx'), c.req.param('id'), await body(c))))
    .delete('/:id', async (c) => (await deleteCollection(deps, c.get('ctx'), c.req.param('id')), c.body(null, 204)))
    .post('/:id/restore', async (c) => (await deleteCollection(deps, c.get('ctx'), c.req.param('id'), true), c.body(null, 204)));
}
