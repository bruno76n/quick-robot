// Development seed applied with the same use cases as the product (docs/10 §1.7). Only when the workspace is empty.
// The example business comes from the mockup's own backup (reference/), never from product code.
import {
  addCatalogItems, insertPrinter, listCollections, insertSpoolMovements, insertSupplyMovements, insertTasks, listChannels, listFilaments, setWorkspaceName,
  transaction, updateProduct, type Ctx,
} from '@app/db';
import { loadMockupBackup, SPEC_KEYS, SPOOL_MOVEMENT_KIND, SUPPLY_MOVEMENT_KIND, type MockupBackup } from '@app/db/seed';
import { seedSellData } from './dev-seed-sell';
import { normalizeName, toCents } from '@app/core';
import type { Deps } from './deps';
import { addSpool } from './usecases/add-spool';
import { saveCollection, saveProduct } from './usecases/products';
import { addChannel, ensureWorkspaceDefaults, removeChannel, updateChannel, updateSettings } from './usecases/settings';
import { createSupplier } from './usecases/suppliers';
import { createSupply } from './usecases/supplies';

// eslint-disable-next-line max-lines-per-function
export async function applyDevelopmentSeed(deps: Deps, ctx: Ctx, path?: string): Promise<boolean> {
  if ((await listFilaments(deps.db, ctx, { page: 1, pageSize: 1 })).total > 0) return false;
  await applyMockupBackup(deps, ctx, loadMockupBackup(path));
  return true;
}

/** Loads a mockup v7 backup into an empty workspace with the product's use cases (seed and importer, docs/05). */
// eslint-disable-next-line max-lines-per-function
export async function applyMockupBackup(deps: Deps, ctx: Ctx, b: MockupBackup, hooks: MockupHooks = {}) {
  const refs = new Map<string, string>([...b.imps, ...b.pedidos, ...b.ventas].map((x) => [x.id, deps.ids.next()]));
  const n = b.config.negocio;
  await setWorkspaceName(deps.db, ctx, n.nombre);
  await ensureWorkspaceDefaults(deps, ctx);
  await updateSettings(deps, ctx, {
    kwhPriceCents: toCents(b.config.kwh), failurePct: b.config.fallos, purgePct: b.config.purga, minMarginPct: b.config.margenMin, formulaMarginPct: b.config.margenFormula,
    business: { name: n.nombre, trade: n.giro, phone: n.tel, email: n.email, city: n.ciudad, quoteValidDays: n.vigencia, footer: n.pie },
  });
  const before = await listChannels(deps.db, ctx);
  for (const ch of b.config.canales) await addChannel(deps, ctx, { name: ch.n, commissionPct: ch.c }).catch(() => undefined);
  for (const ch of before) if (!b.config.canales.some((x) => normalizeName(x.n) === ch.nameKey)) await removeChannel(deps, ctx, ch.id);
  for (const ch of await listChannels(deps.db, ctx)) {
    const position = b.config.canales.findIndex((x) => normalizeName(x.n) === ch.nameKey);
    if (position >= 0 && position !== ch.position) await updateChannel(deps, ctx, ch.id, { position });
  }
  await transaction(deps.db, (tx) => addCatalogItems(tx, ctx, [
    ...b.cat.materiales.map((name) => ({ kind: 'material', name })), ...b.cat.colores.map((c) => ({ kind: 'color', name: c.n, hex: c.hex })), ...b.cat.marcas.map((name) => ({ kind: 'brand', name })),
  ].map((x) => ({ id: deps.ids.next(), nameKey: normalizeName(x.name), hex: null, ...x }))));

  const supplierIds = new Map<string, string>();
  for (const p of b.proveedores) supplierIds.set(p.id, (await createSupplier(deps, ctx, { name: p.nombre, phone: p.tel, brands: p.marcas, note: p.nota })).id);

  const spoolIds = new Map<string, string>();
  const filamentIds = new Map<string, string>();
  for (const r of b.rollos) {
    const f = b.filamentos.find((x) => x.id === r.fil)!;
    const out = await addSpool(deps, ctx, {
      filament: { material: f.material, color: f.color, hex: f.hex }, brand: r.marca, costCents: toCents(r.costo), shippingCents: toCents(r.envio), grams: r.gramos, purchasedOn: r.fecha,
    });
    spoolIds.set(r.id, out.spool.id);
    filamentIds.set(f.id, out.filament.id);
  }
  const rest = b.movs.filter((m) => m.tipo !== 'compra' && spoolIds.has(m.rollo));
  await transaction(deps.db, (tx) => insertSpoolMovements(tx, ctx, rest.map((m) => ({
    id: deps.ids.next(), spoolId: spoolIds.get(m.rollo)!, on: m.fecha, kind: SPOOL_MOVEMENT_KIND[m.tipo] ?? 'adjustment', grams: m.g, note: m.nota, refId: m.ref ? refs.get(m.ref) ?? null : null,
  }))));

  const supplyIds = new Map<string, string>();
  for (const i of b.insumos) {
    supplyIds.set(i.id, (await createSupply(deps, ctx, { name: i.nombre, unit: i.unidad, costCents: toCents(i.costo), minimum: i.minimo, note: i.nota, supplierId: supplierIds.get(i.prov) ?? null })).id);
  }
  await transaction(deps.db, (tx) => insertSupplyMovements(tx, ctx, b.imovs.filter((m) => supplyIds.has(m.ins)).map((m) => ({
    id: deps.ids.next(), supplyId: supplyIds.get(m.ins)!, on: m.fecha, kind: SUPPLY_MOVEMENT_KIND[m.tipo] ?? 'adjustment', qty: m.n, note: m.nota, refId: m.ref ? refs.get(m.ref) ?? null : null,
  }))));

  const printerIds = new Map<string, string>();
  await transaction(deps.db, async (tx) => {
    for (const p of b.impresoras) {
      const row = await insertPrinter(tx, ctx, { id: deps.ids.next(), name: p.nombre, costCents: toCents(p.costo), lifeHours: p.vidaH, maintenanceCentsPerHour: toCents(p.mantoH), kw: p.kw, hours: p.horas, purchasedOn: p.compra || null });
      printerIds.set(p.id, row.id);
      await insertTasks(tx, ctx, p.mant.map((t, i) => ({ id: deps.ids.next(), printerId: row.id, task: t.tarea, everyHours: t.cadaH, lastHours: t.ultH, lastOn: t.fecha || null, position: i })));
    }
  });

  const productIds = new Map<string, string>();
  for (const p of [...b.productos].sort((x, y) => Number(Boolean(x.padre)) - Number(Boolean(y.padre)))) {
    const spec = p.ficha ? Object.fromEntries(Object.entries(p.ficha).filter(([k]) => SPEC_KEYS[k]).map(([k, v]) => [SPEC_KEYS[k], String(v)])) : null;
    const saved = await saveProduct(deps, ctx, {
      name: p.nombre, tags: p.tags, mode: p.modo === 'formula' ? 'formula' : 'value', priceCents: toCents(p.precio), marginPct: p.margen ?? null,
      printerId: printerIds.get(p.imp) ?? null, hours: p.horas, batchSize: Math.max(1, p.lote || 1), extrasCents: toCents(p.extras), tracksStock: p.stock,
      filaments: p.filamentos.filter((f) => filamentIds.has(f.fil)).map((f) => ({ filamentId: filamentIds.get(f.fil)!, grams: f.g })),
      supplies: (p.insumos ?? []).filter((x) => supplyIds.has(x.ins)).map((x) => ({ supplyId: supplyIds.get(x.ins)!, qty: x.cant })),
      spec, note: p.nota, photoFileId: null,
    });
    productIds.set(p.id, saved.id);
  }
  await setParents(deps, ctx, b.productos.filter((p) => p.padre).map((p) => [productIds.get(p.id)!, productIds.get(p.padre!)!] as const));
  for (const c of b.colecciones) {
    await saveCollection(deps, ctx, { name: c.nombre, tags: c.tags, parts: c.partes.filter((x) => productIds.has(x.prod)).map((x) => ({ productId: productIds.get(x.prod)!, qty: x.cant })), extrasCents: toCents(c.extras), priceCents: toCents(c.precio), note: c.nota });
  }
  const collectionIds = new Map<string, string>();
  const cols = await listCollections(deps.db, ctx);
  for (const c of b.colecciones) { const row = cols.find((x) => x.name === c.nombre); if (row) collectionIds.set(c.id, row.id); }
  await seedSellData(deps, ctx, b, { refs, productIds, collectionIds, printerIds, filamentIds, customerLogo: hooks.image ? (dataUrl) => hooks.image!(dataUrl, 'customer_logo') : undefined, notes: hooks.notes ?? [] });
  if (hooks.image) {
    for (const p of b.productos) {
      const foto = (p as { foto?: string }).foto;
      const id = productIds.get(p.id);
      if (!foto || !id) continue;
      const fileId = await hooks.image(foto, 'product_photo');
      if (fileId) await transaction(deps.db, (tx) => updateProduct(tx, ctx, id, { photoFileId: fileId }));
    }
  }
  return { productIds, filamentIds, printerIds, collectionIds, refs };
}

export interface MockupHooks { image?: (dataUrl: string, kind: 'product_photo' | 'customer_logo') => Promise<string | null>; notes?: string[] }

async function setParents(deps: Deps, ctx: Ctx, pairs: readonly (readonly [string, string])[]) {
  await transaction(deps.db, async (tx) => { for (const [id, parentId] of pairs) await updateProduct(tx, ctx, id, { parentId }); });
}
