// Clientes (docs/04 §12, docs/06 §12, docs/12 §9).
import { BusinessError, type CustomerInput, type CustomerPatch } from '@app/contract';
import { customerStats, normalizeName, orderOwed, orderTotal, saleGross, saleIncome, saleOwed, saleProfit, tidyName, type OrderStatus } from '@app/core';
import {
  findCustomerByKey, getCustomer, insertCustomer, listChannels, listCustomers, listOrders, listSales, setCustomerDeleted, transaction, updateCustomer,
  usageOf, type Ctx, type CustomerRow, type Executor,
} from '@app/db';
import type { Deps } from '../../deps';
import { notFound } from '../../http';
import { childrenOf, cents, commissionOf, itemsText, orderData, saleData } from './common';

const view = (c: CustomerRow) => ({ id: c.id, name: c.name, type: c.type, phone: c.phone, note: c.note, hasLogo: c.hasLogo, logoUrl: c.logoFileId ? `/api/v1/files/${c.logoFileId}` : null, logoFileId: c.logoFileId, createdOn: c.createdOn });

async function statsOf(ex: Executor, ctx: Ctx, customerId?: string) {
  const channels = await listChannels(ex, ctx);
  const orders = await listOrders(ex, ctx, customerId ? { customerId } : {});
  const sales = await listSales(ex, ctx, customerId ? { customerId } : {});
  const oc = await childrenOf(ex, ctx, 'order', orders.map((o) => o.id));
  const sc = await childrenOf(ex, ctx, 'sale', sales.map((s) => s.id));
  const od = orders.map((o) => ({ row: o, data: orderData(o, oc.items(o.id), oc.payments(o.id), commissionOf(channels, o.channelId)) }));
  const sd = sales.map((s) => ({ row: s, data: { ...saleData(s, sc.items(s.id), sc.payments(s.id), commissionOf(channels, s.channelId)), on: s.on } }));
  const of = (id: string) => customerStats(od.filter((o) => o.row.customerId === id).map((o) => o.data), sd.filter((s) => s.row.customerId === id).map((s) => s.data));
  return { of, od, sd, oc, sc };
}

const totalsView = (s: ReturnType<typeof customerStats>) => ({ orders: s.orders, activeOrders: s.activeOrders, sales: s.sales, incomeCents: cents(s.income), profitCents: cents(s.profit), owedCents: cents(s.owed), lastActivity: s.lastActivity });

export async function customerList(_deps: Deps, ex: Executor, ctx: Ctx, q?: string) {
  const list = await listCustomers(ex, ctx, { q });
  const { of } = await statsOf(ex, ctx);
  return list.map((c) => ({ ...view(c), ...totalsView(of(c.id)) }));
}

export async function customerDetail(_deps: Deps, ex: Executor, ctx: Ctx, id: string) {
  const c = await getCustomer(ex, ctx, id);
  if (!c) throw notFound('customer');
  const { of, od, sd, oc, sc } = await statsOf(ex, ctx, id);
  const history = [
    ...od.map(({ row, data }) => ({ kind: 'order' as const, id: row.id, number: row.number, on: row.createdOn, dueOn: row.dueOn, status: row.status as OrderStatus, itemsText: itemsText(oc.items(row.id)), totalCents: cents(orderTotal(data)), owedCents: cents(orderOwed({ ...data })) })),
    ...sd.map(({ row, data }) => ({ kind: 'sale' as const, id: row.id, on: row.on, itemsText: itemsText(sc.items(row.id)), totalCents: cents(saleIncome(data)), grossCents: cents(saleGross(data)), profitCents: cents(saleProfit(data)), owedCents: cents(saleOwed(data)), returned: !!row.return, orderId: row.orderId })),
  ].sort((a, b) => b.on.localeCompare(a.on));
  return { ...view(c), totals: totalsView(of(id)), history };
}

function row(input: CustomerPatch) {
  return {
    ...(input.name !== undefined ? { name: tidyName(input.name), nameKey: normalizeName(input.name) } : {}),
    ...(input.type !== undefined ? { type: input.type.trim() } : {}), ...(input.phone !== undefined ? { phone: input.phone.trim() } : {}),
    ...(input.note !== undefined ? { note: input.note.trim() } : {}),
    ...(input.logoFileId !== undefined ? { logoFileId: input.logoFileId, hasLogo: input.hasLogo ?? !!input.logoFileId } : input.hasLogo !== undefined ? { hasLogo: input.hasLogo } : {}),
  };
}

export async function createCustomer(deps: Deps, ctx: Ctx, input: CustomerInput) {
  const id = await transaction(deps.db, async (tx) => {
    if (await findCustomerByKey(tx, ctx, normalizeName(input.name))) throw new BusinessError('CUSTOMER_NAME_EXISTS', { name: tidyName(input.name) });
    const r = row(input);
    return (await insertCustomer(tx, ctx, { id: deps.ids.next(), name: r.name!, nameKey: r.nameKey!, type: r.type!, ...r, createdOn: deps.clock.today() })).id;
  });
  return customerDetail(deps, deps.db, ctx, id);
}

export async function updateCustomerUc(deps: Deps, ctx: Ctx, id: string, input: CustomerPatch) {
  await transaction(deps.db, async (tx) => {
    if (!(await getCustomer(tx, ctx, id))) throw notFound('customer');
    if (input.name !== undefined && await findCustomerByKey(tx, ctx, normalizeName(input.name), id)) throw new BusinessError('CUSTOMER_NAME_EXISTS', { name: tidyName(input.name) });
    await updateCustomer(tx, ctx, id, row(input));
  });
  return customerDetail(deps, deps.db, ctx, id);
}

export async function removeCustomerLogo(deps: Deps, ctx: Ctx, id: string) {
  await transaction(deps.db, async (tx) => {
    if (!(await getCustomer(tx, ctx, id))) throw notFound('customer');
    await updateCustomer(tx, ctx, id, { logoFileId: null });
  });
  return customerDetail(deps, deps.db, ctx, id);
}

export async function deleteCustomer(deps: Deps, ctx: Ctx, id: string) {
  await transaction(deps.db, async (tx) => {
    if (!(await getCustomer(tx, ctx, id))) throw notFound('customer');
    const used = await usageOf(tx, ctx, { customerId: id });
    if (used.orders || used.sales) throw new BusinessError('CUSTOMER_HAS_HISTORY', used);
    await setCustomerDeleted(tx, ctx, id, deps.clock.now());
  });
}

export async function restoreCustomer(deps: Deps, ctx: Ctx, id: string) {
  await transaction(deps.db, async (tx) => {
    const c = await getCustomer(tx, ctx, id, { deleted: true });
    if (!c) throw notFound('customer');
    if (await findCustomerByKey(tx, ctx, c.nameKey)) throw new BusinessError('RESTORE_CONFLICT', { entity: 'customer', reason: 'name' });
    await setCustomerDeleted(tx, ctx, id, null);
  });
  return customerDetail(deps, deps.db, ctx, id);
}
