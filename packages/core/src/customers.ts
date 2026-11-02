// Customers (docs/04 §12): totals from their orders and sales.
import { isActive, orderOwed, type OrderData } from './orders';
import { saleOwed, salesTotals, type SaleData } from './sales';

export function customerStats(orders: readonly (OrderData & { createdOn: string; dueOn: string })[], sales: readonly (SaleData & { on: string })[]) {
  const active = orders.filter((o) => isActive(o.status));
  const t = salesTotals(sales.filter((s) => !s.returned));
  const dates = [...sales.map((s) => s.on), ...orders.map((o) => o.createdOn || o.dueOn)].filter(Boolean).sort();
  return {
    orders: orders.length, activeOrders: active.length, sales: sales.length, income: t.income, profit: t.profit,
    owed: active.reduce((a, o) => a + orderOwed(o), 0) + sales.reduce((a, s) => a + saleOwed(s), 0),
    lastActivity: dates.at(-1) ?? null,
  };
}

/** Same name ignoring case, accents and spaces (CUSTOMER_NAME_EXISTS). */
export { normalizeName as customerKey } from './catalog';
