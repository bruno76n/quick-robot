import { Hono } from 'hono';
import type { AppDeps } from '../deps';
import type { AppEnv } from '../env';
import { getSupplyDetail, listSuppliers, listSupplies } from '../queries/supplies';
import { createSupplier, createSupply, deleteSupplier, deleteSupply, recordSupplyMovement, recordSupplyPurchase, updateSupplier, updateSupply } from '../usecases/supplies';
import { body } from './body';

export function supplyRoutes(deps: AppDeps) {
  return new Hono<AppEnv>()
    .get('/', async (c) => c.json(await listSupplies(deps.database.db, c.get('ctx'))))
    .post('/', async (c) => c.json(await createSupply(deps, c.get('ctx'), await body(c)), 201))
    .get('/:id', async (c) => c.json(await getSupplyDetail(deps.database.db, c.get('ctx'), c.req.param('id'))))
    .put('/:id', async (c) => c.json(await updateSupply(deps, c.get('ctx'), c.req.param('id'), await body(c))))
    .delete('/:id', async (c) => (await deleteSupply(deps, c.get('ctx'), c.req.param('id')), c.body(null, 204)))
    .post('/:id/restore', async (c) => (await deleteSupply(deps, c.get('ctx'), c.req.param('id'), true), c.body(null, 204)))
    .post('/:id/purchases', async (c) => c.json(await recordSupplyPurchase(deps, c.get('ctx'), c.req.param('id'), await body(c)), 201))
    .post('/:id/movements', async (c) => c.json(await recordSupplyMovement(deps, c.get('ctx'), c.req.param('id'), await body(c)), 201));
}

export function supplierRoutes(deps: AppDeps) {
  return new Hono<AppEnv>()
    .get('/', async (c) => c.json(await listSuppliers(deps.database.db, c.get('ctx'))))
    .post('/', async (c) => c.json(await createSupplier(deps, c.get('ctx'), await body(c)), 201))
    .put('/:id', async (c) => c.json(await updateSupplier(deps, c.get('ctx'), c.req.param('id'), await body(c))))
    .delete('/:id', async (c) => (await deleteSupplier(deps, c.get('ctx'), c.req.param('id')), c.body(null, 204)))
    .post('/:id/restore', async (c) => (await deleteSupplier(deps, c.get('ctx'), c.req.param('id'), true), c.body(null, 204)));
}
