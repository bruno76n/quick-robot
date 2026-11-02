// Read paths for big data sets (docs/15 §1–3): sums come from SQL (saleFacts, saleTotals, orderFacts),
// the app only applies the rules of core on one row per sale or order.
import { ALL_TIME_FROM, customerStats, expensesInRange, isActive, orderOwed, saleCommission, saleCost, saleIncome, saleOwed, saleProfit, type OrderStatus } from '@app/core';
import { listChannels, listCustomers, listExpenses, orderFacts, saleFacts, saleTotals, type Ctx, type Executor, type OrderFact, type SaleFilter, type SaleTotalsRow } from '@app/db';
import { cents, commissionOf, factSale } from './common';

const pct = (profit: number, income: number) => (income ? Math.round((profit / income) * 1000) / 10 : 0);
export const totalsOf = (r: SaleTotalsRow | undefined) => {
  const t = r ?? { count: 0, grossCents: 0, incomeCents: 0, commissionCents: 0, costCents: 0, owedCents: 0, pieces: 0, listCents: 0, key: null };
  const profit = t.incomeCents - t.commissionCents - t.costCents;
  return { count: t.count, incomeCents: Math.round(t.incomeCents), commissionCents: Math.round(t.commissionCents), costCents: Math.round(t.costCents), profitCents: Math.round(profit), owedCents: Math.round(t.owedCents), pieces: t.pieces, listCents: Math.round(t.listCents), marginPct: pct(profit, t.incomeCents) };
};

export async function saleListFast(ex: Executor, ctx: Ctx, f: SaleFilter & { q?: string | undefined; page: number; pageSize: number }) {
  const channels = await listChannels(ex, ctx);
  const customers = new Map((await listCustomers(ex, ctx, { withDeleted: true })).map((c) => [c.id, c.name]));
  const [tot] = await saleTotals(ex, ctx, f);
  const page = await saleFacts(ex, ctx, { ...f, limit: f.pageSize, offset: (f.page - 1) * f.pageSize });
  const t = totalsOf(tot);
  return {
    items: page.map((s) => {
      const d = factSale(s, commissionOf(channels, s.channelId));
      return {
        id: s.id, on: s.on, channelId: s.channelId, channel: channels.find((c) => c.id === s.channelId)?.name ?? '', customerId: s.customerId,
        customer: s.customerId ? customers.get(s.customerId) ?? '' : '', itemsText: s.itemsText, note: s.note, totalCents: Math.round(s.grossCents),
        incomeCents: cents(saleIncome(d)), costCents: cents(saleCost(d)), commissionCents: cents(saleCommission(d)), profitCents: cents(saleProfit(d)),
        owedCents: cents(saleOwed(d)), returned: !!s.return, orderId: s.orderId, pieces: s.return ? 0 : s.pieces,
      };
    }),
    page: f.page, pageSize: f.pageSize, total: t.count,
    totals: { count: t.count, incomeCents: t.incomeCents, profitCents: t.profitCents, costCents: t.costCents, owedCents: t.owedCents },
  };
}

const orderData = (o: OrderFact) => ({ status: o.status as OrderStatus, items: [{ kind: 'piece' as const, name: '', qty: 1, price: o.grossCents / 100, list: 0, cost: o.costCents / 100 }], commissionPct: 0, payments: [o.paidCents / 100] });

/** Per customer: orders, active, sales, income, profit, owed and last activity (docs/04 §12), from SQL sums. */
export async function customerTotals(ex: Executor, ctx: Ctx, customerId?: string) {
  const channels = await listChannels(ex, ctx);
  const sales = await saleFacts(ex, ctx, customerId ? { customerId } : {});
  const orders = await orderFacts(ex, ctx, customerId ? { customerId } : {});
  const bySale = new Map<string, typeof sales>();
  for (const s of sales) if (s.customerId) bySale.set(s.customerId, [...(bySale.get(s.customerId) ?? []), s]);
  const byOrder = new Map<string, OrderFact[]>();
  for (const o of orders) byOrder.set(o.customerId, [...(byOrder.get(o.customerId) ?? []), o]);
  return (id: string) => {
    const st = customerStats(
      (byOrder.get(id) ?? []).map((o) => ({ ...orderData(o), createdOn: o.createdOn, dueOn: o.dueOn })),
      (bySale.get(id) ?? []).map((s) => ({ ...factSale(s, commissionOf(channels, s.channelId)), on: s.on })),
    );
    return { orders: st.orders, activeOrders: st.activeOrders, sales: st.sales, incomeCents: cents(st.income), profitCents: cents(st.profit), owedCents: cents(st.owed), lastActivity: st.lastActivity };
  };
}

export const activeOwed = (orders: readonly OrderFact[]) => orders.filter((o) => isActive(o.status as OrderStatus)).reduce((a, o) => a + orderOwed(orderData(o)), 0);

/** Gross profit since always (SQL totals) and expenses since always to today (docs/04 §10–11). */
export async function grossProfitAndExpensesFast(ex: Executor, ctx: Ctx, today: string) {
  const t = totalsOf((await saleTotals(ex, ctx))[0]);
  const exp = await listExpenses(ex, ctx);
  return { grossProfit: t.profitCents / 100, expenses: expensesInRange(exp.map((e) => ({ on: e.on, amount: e.amountCents / 100, recurring: e.recurring, endsOn: e.endsOn })), ALL_TIME_FROM, today) };
}
