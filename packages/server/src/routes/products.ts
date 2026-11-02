// Pieces and collections (docs/12 §5).
import { saveCollectionInput, saveProductInput } from '@app/contract';
import { z } from 'zod';
import { body, idParam, noContent, ok, query } from '../http';
import {
  collectionDetail, collectionList, deleteCollection, deleteProduct, productDetail, productList, restoreCollection, restoreProduct,
  saveCollection, saveProduct, saveProductAsVariant,
} from '../usecases/products';
import type { Router } from './router';

const listQuery = z.object({ q: z.string().max(120).optional(), filter: z.enum(['all', 'technical', 'variant']).default('all') });
const page = <T>(items: T[]) => ({ items, page: 1, pageSize: items.length, total: items.length });

export function productRoutes(r: Router) {
  r.get('/products', 'product.read', async (c) => {
    const q = query(c, listQuery);
    return ok(c, page(await productList(c.get('deps'), c.get('deps').db, c.get('ctx'), q.filter, q.q)));
  });
  r.get('/products/:id', 'product.read', async (c) => ok(c, await productDetail(c.get('deps'), c.get('deps').db, c.get('ctx'), idParam(c, 'id', 'product'))));
  r.post('/products', 'product.create', async (c) => ok(c, await saveProduct(c.get('deps'), c.get('ctx'), await body(c, saveProductInput)), 201));
  r.put('/products/:id', 'product.update', async (c) => ok(c, await saveProduct(c.get('deps'), c.get('ctx'), await body(c, saveProductInput), idParam(c, 'id', 'product'))));
  r.post('/products/:id/variant', 'product.create', async (c) => ok(c, await saveProductAsVariant(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'product'), await body(c, saveProductInput)), 201));
  r.delete('/products/:id', 'product.delete', async (c) => { await deleteProduct(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'product')); return noContent(c); });
  r.post('/products/:id/restore', 'product.delete', async (c) => ok(c, await restoreProduct(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'product'))));

  r.get('/collections', 'collection.read', async (c) => ok(c, page(await collectionList(c.get('deps'), c.get('deps').db, c.get('ctx'), query(c, z.object({ q: z.string().max(120).optional() })).q))));
  r.get('/collections/:id', 'collection.read', async (c) => ok(c, await collectionDetail(c.get('deps'), c.get('deps').db, c.get('ctx'), idParam(c, 'id', 'collection'))));
  r.post('/collections', 'collection.create', async (c) => ok(c, await saveCollection(c.get('deps'), c.get('ctx'), await body(c, saveCollectionInput)), 201));
  r.put('/collections/:id', 'collection.update', async (c) => ok(c, await saveCollection(c.get('deps'), c.get('ctx'), await body(c, saveCollectionInput), idParam(c, 'id', 'collection'))));
  r.delete('/collections/:id', 'collection.delete', async (c) => { await deleteCollection(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'collection')); return noContent(c); });
  r.post('/collections/:id/restore', 'collection.delete', async (c) => ok(c, await restoreCollection(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'collection'))));
}
