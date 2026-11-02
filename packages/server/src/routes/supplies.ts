import { Hono } from 'hono';
import type { AppDeps } from '../deps';
import type { AppEnv } from '../env';
import { guard } from '../middleware/guard';
import { getSupplyDetail, listSuppliers, listSupplies } from '../queries/supplies';
import { createSupplier, createSupply, deleteSupplier, deleteSupply, recordSupplyMovement, recordSupplyPurchase, updateSupplier, updateSupply } from '../usecases/supplies';
import { body } from './body';

export function supplyRoutes(deps: AppDeps) {
  return new Hono<AppEnv>()
    .get('/', guard('supplies.read'), async (c) => c.json(await listSupplies(deps.database.db, c.get('ctx'))))
    .post('/', guard('supplies.write'), async (c) => c.json(await createSupply(deps, c.get('ctx'), await body(c)), 201))
    .get('/:id', guard('supplies.read'), async (c) => c.json(await getSupplyDetail(deps.database.db, c.get('ctx'), c.req.param('id'))))
    .put('/:id', guard('supplies.write'), async (c) => c.json(await updateSupply(deps, c.get('ctx'), c.req.param('id'), await body(c))))
    .delete('/:id', guard('supplies.delete'), async (c) => (await deleteSupply(deps, c.get('ctx'), c.req.param('id')), c.body(null, 204)))
    .post('/:id/restore', guard('supplies.delete'), async (c) => (await deleteSupply(deps, c.get('ctx'), c.req.param('id'), true), c.body(null, 204)))
    .post('/:id/purchases', guard('supplies.write'), async (c) => c.json(await recordSupplyPurchase(deps, c.get('ctx'), c.req.param('id'), await body(c)), 201))
    .post('/:id/movements', guard('supplies.write'), async (c) => c.json(await recordSupplyMovement(deps, c.get('ctx'), c.req.param('id'), await body(c)), 201));
}

export function supplierRoutes(deps: AppDeps) {
  return new Hono<AppEnv>()
    .get('/', guard('suppliers.read'), async (c) => c.json(await listSuppliers(deps.database.db, c.get('ctx'))))
    .post('/', guard('suppliers.write'), async (c) => c.json(await createSupplier(deps, c.get('ctx'), await body(c)), 201))
    .put('/:id', guard('suppliers.write'), async (c) => c.json(await updateSupplier(deps, c.get('ctx'), c.req.param('id'), await body(c))))
    .delete('/:id', guard('suppliers.delete'), async (c) => (await deleteSupplier(deps, c.get('ctx'), c.req.param('id')), c.body(null, 204)))
    .post('/:id/restore', guard('suppliers.delete'), async (c) => (await deleteSupplier(deps, c.get('ctx'), c.req.param('id'), true), c.body(null, 204)));
}
