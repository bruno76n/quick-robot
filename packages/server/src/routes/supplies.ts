// Supplies and suppliers (docs/12 §8).
import { createSupplyInput, pageQuery, supplierInput, supplyMovementInput, supplyPurchaseInput, updateSupplyInput } from '@app/contract';
import { listSuppliers, listSupplies } from '@app/db';
import { body, idParam, noContent, ok, query } from '../http';
import { createSupplier, deleteSupplier, restoreSupplier, supplierView, updateSupplier } from '../usecases/suppliers';
import {
  createSupply, deleteSupply, recordSupplyMovement, recordSupplyPurchase, restoreSupply, supplyDetailView, supplyListView, updateSupply,
} from '../usecases/supplies';
import type { Router } from './router';

export function supplyRoutes(r: Router) {
  r.get('/supplies', 'supply.read', async (c) => {
    const { db } = c.get('deps');
    const ctx = c.get('ctx');
    const q = query(c, pageQuery);
    const { items, total } = await listSupplies(db, ctx, q);
    const suppliers = new Map((await listSuppliers(db, ctx, { withDeleted: true })).map((s) => [s.id, s]));
    return ok(c, { items: items.map((s) => supplyListView(s, s.supplierId ? suppliers.get(s.supplierId) : undefined)), page: q.page, pageSize: q.pageSize, total });
  });
  r.get('/supplies/:id', 'supply.read', async (c) => ok(c, await supplyDetailView(c.get('deps').db, c.get('ctx'), idParam(c, 'id', 'supply'))));
  r.post('/supplies', 'supply.create', async (c) => ok(c, await createSupply(c.get('deps'), c.get('ctx'), await body(c, createSupplyInput)), 201));
  r.patch('/supplies/:id', 'supply.update', async (c) => ok(c, await updateSupply(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'supply'), await body(c, updateSupplyInput))));
  r.delete('/supplies/:id', 'supply.delete', async (c) => { await deleteSupply(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'supply')); return noContent(c); });
  r.post('/supplies/:id/restore', 'supply.delete', async (c) => ok(c, await restoreSupply(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'supply'))));
  r.post('/supplies/:id/purchases', 'supply.movement', async (c) => ok(c, await recordSupplyPurchase(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'supply'), await body(c, supplyPurchaseInput)), 201));
  r.post('/supplies/:id/movements', 'supply.movement', async (c) => ok(c, await recordSupplyMovement(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'supply'), await body(c, supplyMovementInput)), 201));

  r.get('/suppliers', 'supplier.read', async (c) => ok(c, (await listSuppliers(c.get('deps').db, c.get('ctx'))).map(supplierView)));
  r.post('/suppliers', 'supplier.create', async (c) => ok(c, await createSupplier(c.get('deps'), c.get('ctx'), await body(c, supplierInput)), 201));
  r.patch('/suppliers/:id', 'supplier.update', async (c) => ok(c, await updateSupplier(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'supplier'), await body(c, supplierInput))));
  r.delete('/suppliers/:id', 'supplier.delete', async (c) => { await deleteSupplier(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'supplier')); return noContent(c); });
  r.post('/suppliers/:id/restore', 'supplier.delete', async (c) => ok(c, await restoreSupplier(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'supplier'))));
}
