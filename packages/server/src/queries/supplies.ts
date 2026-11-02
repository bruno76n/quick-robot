import { BusinessError, type Supplier, type Supply, type SupplyDetail, type SupplyList } from '@app/contract';
import { fromCents, supplyStatus, supplyValue, toCents } from '@app/core';
import { supplierRepo, supplyRepo, type Ctx, type Executor, type SupplierRow, type SupplyRow } from '@app/db';

const toSupplier = (s: SupplierRow): Supplier => ({ id: s.id, name: s.name, phone: s.phone, brands: s.brands, note: s.note });

function toSupply(s: SupplyRow, stock: number, suppliers: Map<string, SupplierRow>, usedBy: Supply['usedBy']): Supply {
  const sup = s.supplierId ? suppliers.get(s.supplierId) : undefined;
  return {
    id: s.id,
    name: s.name,
    unit: s.unit,
    costCents: s.costCents,
    minimum: s.minimum,
    note: s.note,
    supplierId: sup ? s.supplierId : null,
    supplierName: sup?.name ?? null,
    stock,
    status: supplyStatus(stock, s.minimum),
    valueCents: toCents(supplyValue(stock, fromCents(s.costCents))),
    usedBy,
  };
}

export async function listSupplies(ex: Executor, ctx: Ctx): Promise<SupplyList> {
  const [rows, stock, suppliers] = await Promise.all([supplyRepo.list(ex, ctx), supplyRepo.stockBySupply(ex, ctx), supplierRepo.list(ex, ctx)]);
  const used = await supplyRepo.usedBy(ex, ctx, rows.map((r) => r.id));
  const supMap = new Map(suppliers.map((s) => [s.id, s]));
  const items = rows.map((r) =>
    toSupply(r, stock.get(r.id) ?? 0, supMap, used.filter((u) => u.supplyId === r.id).map((u) => ({ productId: u.productId, productName: u.productName, qty: u.qty }))),
  );
  return {
    items,
    totals: { count: items.length, valueCents: items.reduce((t, i) => t + i.valueCents, 0), toRestock: items.filter((i) => i.stock <= i.minimum).length },
    suppliers: suppliers.map(toSupplier),
  };
}

export async function getSupplyDetail(ex: Executor, ctx: Ctx, id: string): Promise<SupplyDetail> {
  const row = await supplyRepo.get(ex, ctx, id);
  if (!row) throw new BusinessError('SUPPLY_NOT_FOUND');
  const [stock, suppliers, used, movements] = await Promise.all([supplyRepo.stockBySupply(ex, ctx), supplierRepo.list(ex, ctx), supplyRepo.usedBy(ex, ctx, [id]), supplyRepo.listMovements(ex, ctx, id)]);
  return {
    ...toSupply(row, stock.get(id) ?? 0, new Map(suppliers.map((s) => [s.id, s])), used.map((u) => ({ productId: u.productId, productName: u.productName, qty: u.qty }))),
    movements: movements.map((m) => ({ id: m.id, on: m.on, kind: m.kind, qty: m.qty, note: m.note })),
  };
}

export async function listSuppliers(ex: Executor, ctx: Ctx): Promise<Supplier[]> {
  return (await supplierRepo.list(ex, ctx)).map(toSupplier);
}
