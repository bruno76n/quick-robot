// GET /stock by families (docs/12 §8, mejoras/ronda-2.md §4): a simple piece or a family with the sum of its members,
// its status (docs/04 §5 case 5.3), counts per status, free-first order and the printer of each piece.
import type { StockMember, StockPage, StockQuery, StockRow } from '@app/contract';
import { buildableSets, familyStockStatus, stockStatus } from '@app/core';
import { listCollections, listPrinters, listProducts, type Ctx, type Executor, type ProductFull } from '@app/db';
import type { Deps } from '../../deps';
import { costOf, displayNames, loadCostingContext, priceOf, supplyIdsOf } from '../../views/costing';
import { photoUrl } from '../products';
import { loadStock } from './common';

const STATUS_KEY = { all: 'all', few: 'few', all_reserved: 'allReserved', ok: 'ok', out: 'out' } as const;

export async function stockList(deps: Deps, ex: Executor, ctx: Ctx, q: StockQuery): Promise<StockPage> {
  const products = await listProducts(ex, ctx);
  const st = await loadStock(ex, ctx, products);
  const c = await loadCostingContext(ex, ctx, supplyIdsOf(products));
  const names = displayNames(products);
  const printers = new Map((await listPrinters(ex, ctx)).map((p) => [p.id, p.name]));
  const alive = new Map(products.map((p) => [p.id, p]));
  const rootOf = (p: ProductFull) => (p.parentId && alive.has(p.parentId) ? p.parentId : p.id);

  const member = async (p: ProductFull): Promise<StockMember> => {
    const physical = st.physical.get(p.id) ?? 0;
    const reserved = Math.min(physical, st.reserved(p.id));
    const total = costOf(p, c).total;
    const isOriginal = rootOf(p) === p.id;
    return {
      productId: p.id, name: p.name, displayName: names.get(p.id) ?? p.name, label: isOriginal ? null : p.variantLabel, isOriginal,
      photoUrl: await photoUrl(deps, ctx, p.photoFileId), hexes: p.filaments.map((f) => c.filaments.get(f.filamentId)?.hex ?? '#c9c9d1'),
      listCents: Math.round(priceOf(p, c, total) * 100), costCents: Math.round(total * 100), printerName: p.printerId ? printers.get(p.printerId) ?? null : null,
      physical, reserved, free: Math.max(0, physical - reserved), status: stockStatus(physical, reserved),
    };
  };

  // Families of tracked pieces, in catalog order; the original first.
  const groups = new Map<string, ProductFull[]>();
  for (const p of products) if (p.tracksStock) groups.set(rootOf(p), [...(groups.get(rootOf(p)) ?? []), p]);
  const needle = q.q?.trim().toLocaleLowerCase('es') ?? '';
  const hit = (p: ProductFull) => [p.name, p.variantLabel ?? '', names.get(p.id) ?? ''].some((x) => x.toLocaleLowerCase('es').includes(needle));
  const rows: StockRow[] = [];
  for (const [rootId, ms] of groups) {
    if (needle && !ms.some(hit)) continue;
    const list = await Promise.all([...ms].sort((a, b) => Number(rootOf(a) !== a.id) - Number(rootOf(b) !== b.id)).map(member));
    if (list.length === 1) { const { label: _l, isOriginal: _o, ...one } = list[0]!; rows.push({ ...one, name: one.displayName, members: [] }); continue; }
    const root = alive.get(rootId)!;
    const head = list.find((m) => m.isOriginal) ?? await member(root);
    const sum = (k: 'physical' | 'reserved' | 'free') => list.reduce((a, m) => a + m[k], 0);
    rows.push({
      productId: rootId, name: root.name, displayName: root.name, photoUrl: head.photoUrl, hexes: head.hexes, listCents: head.listCents, costCents: head.costCents,
      printerName: head.printerName, physical: sum('physical'), reserved: sum('reserved'), free: sum('free'), status: familyStockStatus(list), members: list,
    });
  }

  const counts = { all: rows.length, few: 0, allReserved: 0, ok: 0, out: 0 };
  for (const r of rows) counts[STATUS_KEY[r.status]] += 1;
  const shown = rows.filter((r) => q.status === 'all' || r.status === q.status)
    .sort((a, b) => (q.sort === 'free_desc' ? b.free - a.free : a.free - b.free) || a.name.localeCompare(b.name, 'es'));
  const cols = await listCollections(ex, ctx);
  return {
    items: shown.slice((q.page - 1) * q.pageSize, q.page * q.pageSize), page: q.page, pageSize: q.pageSize, total: shown.length, counts,
    totals: {
      units: rows.reduce((a, x) => a + x.physical, 0), pieces: rows.length, free: rows.reduce((a, x) => a + x.free, 0), reserved: rows.reduce((a, x) => a + x.reserved, 0),
      physical: rows.reduce((a, x) => a + x.physical, 0),
    },
    untracked: products.filter((p) => !p.tracksStock).map((p) => ({ id: p.id, name: names.get(p.id) ?? p.name })),
    sets: cols.map((col) => ({ id: col.id, name: col.name, buildableSets: buildableSets(col.parts, (id) => (st.tracks.get(id) ? st.free(id) : null)) })),
  };
}
