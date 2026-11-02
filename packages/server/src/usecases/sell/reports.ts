// Gastos, Reportes, Compras, Inicio y búsqueda (docs/04 §9, §10, §13; docs/06 §2, §13–16; docs/12 §8–9).
import type { ExpenseInput } from '@app/contract';
import {
  addDays, ALL_TIME_FROM, daysBetween, expenseInRange, expensesInRange, filamentPurchase, fixedPerMonth, floorPrice, inPeriod, investmentRecovered, isActive,
  itemLines, itemMaterial, maintenanceState, normalizeName, orderOwed, rankProducts, saleOwed, salesTotals, setCost, setPrice, supplyPurchase, type ExpenseData, type OrderStatus,
} from '@app/core';
import {
  getExpense, getSettings, insertExpense, listAllFilaments, listChannels, listCollections, listCustomers, listExpenses, listOrders, listPrinters, listProducts,
  listSales, listSpools, listSuppliers, listSupplies, listSupplyMovements, listTasks, setExpenseDeleted, transaction, updateExpense, type Ctx, type Executor, type ExpenseListRow,
} from '@app/db';
import type { Deps } from '../../deps';
import { notFound } from '../../http';
import { costOf, loadCostingContext, setPartsOf, supplyIdsOf } from '../../views/costing';
import { cents, childrenOf, commissionOf, itemsText, lineItemData, orderData, saleData } from './common';
import { queueViews } from './queue';
// Reportes › taller y estado actual (agent D).
import { orderPaid, orderProfit, orderTotal, saleGross } from '@app/core';
import { listPrintRuns, listSpoolMovements } from '@app/db';
import { priceOf } from '../../views/costing';
import { loadStock } from './common';

const expenseData = (e: ExpenseListRow): ExpenseData => ({ on: e.on, amount: e.amountCents / 100, recurring: e.recurring, endsOn: e.endsOn });
const expenseView = (e: ExpenseListRow, from: string, to: string) => ({ id: e.id, on: e.on, concept: e.concept, category: e.category, amountCents: e.amountCents, recurring: e.recurring, endsOn: e.endsOn, inPeriodCents: cents(expenseInRange(expenseData(e), from, to)) });

// ---------- Expenses ----------
export async function expenseList(deps: Deps, ex: Executor, ctx: Ctx, f: { from?: string | undefined; to?: string | undefined; category?: string | undefined; page: number; pageSize: number }) {
  const today = deps.clock.today();
  const from = f.from ?? ALL_TIME_FROM;
  const to = f.to ?? today;
  const all = await listExpenses(ex, ctx, { category: f.category });
  const inRange = all.filter((e) => expenseInRange(expenseData(e), from, to) > 0 || (e.recurring && e.on <= to && (!e.endsOn || e.endsOn >= from)));
  return {
    items: inRange.slice((f.page - 1) * f.pageSize, f.page * f.pageSize).map((e) => expenseView(e, from, to)), page: f.page, pageSize: f.pageSize, total: inRange.length,
    periodTotalCents: cents(expensesInRange(inRange.map(expenseData), from, to)), fixedPerMonthCents: cents(fixedPerMonth(all.map(expenseData), today)),
    byCategory: [...new Set(inRange.map((e) => e.category))].map((category) => ({ category, cents: cents(expensesInRange(inRange.filter((e) => e.category === category).map(expenseData), from, to)) })).sort((a, b) => b.cents - a.cents),
  };
}

const expenseRow = (i: ExpenseInput) => ({ on: i.on, concept: i.concept.trim(), category: i.category.trim(), amountCents: i.amountCents, recurring: i.recurring, endsOn: i.recurring ? i.endsOn ?? null : null });
export async function createExpense(deps: Deps, ctx: Ctx, input: ExpenseInput) {
  const id = deps.ids.next();
  await transaction(deps.db, (tx) => insertExpense(tx, ctx, { id, ...expenseRow(input) }));
  const e = await getExpense(deps.db, ctx, id);
  return expenseView(e!, ALL_TIME_FROM, deps.clock.today());
}
export async function updateExpenseUc(deps: Deps, ctx: Ctx, id: string, input: ExpenseInput) {
  await transaction(deps.db, async (tx) => { if (!(await updateExpense(tx, ctx, id, expenseRow(input)))) throw notFound('expense'); });
  return expenseView((await getExpense(deps.db, ctx, id))!, ALL_TIME_FROM, deps.clock.today());
}
export async function deleteExpense(deps: Deps, ctx: Ctx, id: string) {
  await transaction(deps.db, async (tx) => { if (!(await setExpenseDeleted(tx, ctx, id, deps.clock.now()))) throw notFound('expense'); });
}
export async function restoreExpense(deps: Deps, ctx: Ctx, id: string) {
  await transaction(deps.db, async (tx) => { if (!(await setExpenseDeleted(tx, ctx, id, null))) throw notFound('expense'); });
  return expenseView((await getExpense(deps.db, ctx, id))!, ALL_TIME_FROM, deps.clock.today());
}

// ---------- Sales data for reports ----------
async function allSales(ex: Executor, ctx: Ctx) {
  const channels = await listChannels(ex, ctx);
  const rows = await listSales(ex, ctx);
  const ch = await childrenOf(ex, ctx, 'sale', rows.map((s) => s.id));
  return { channels, rows, data: rows.map((s) => ({ ...saleData(s, ch.items(s.id), ch.payments(s.id), commissionOf(channels, s.channelId)), customerId: s.customerId })) };
}

/** Gross profit since always and expenses since always to today: the investment of the printers (docs/04 §11). */
export async function grossProfitAndExpenses(ex: Executor, ctx: Ctx, today: string) {
  const { data } = await allSales(ex, ctx);
  const exp = await listExpenses(ex, ctx);
  return { grossProfit: salesTotals(data).profit, expenses: expensesInRange(exp.map(expenseData), ALL_TIME_FROM, today) };
}

const totalsView = (t: ReturnType<typeof salesTotals>, extra: { count: number; list: number; discount: number }) => ({
  incomeCents: cents(t.income), commissionCents: cents(t.commission), costCents: cents(t.cost), profitCents: cents(t.profit), pieces: t.pieces,
  marginPct: Math.round(t.marginPct * 10) / 10, count: extra.count, listCents: cents(extra.list), discountCents: cents(extra.discount),
});

/** Workshop (filament used, print runs, printers) in a range and the current state (inventory, orders in progress) for Reportes. */
async function reportWorkshopAndState(ex: Executor, ctx: Ctx, from: string, to: string) {
  const fils = await listAllFilaments(ex, ctx);
  const spools = await listSpools(ex, ctx, fils.map((f) => f.id));
  const settings = await getSettings(ex, ctx);
  const use = new Map<string, { filamentId: string; name: string; hex: string; grams: number }>();
  let used = 0; let lost = 0;
  for (const f of fils) {
    for (const m of await listSpoolMovements(ex, ctx, f.id, { limit: 100_000 })) {
      if (m.on < from || m.on > to || !['consumption', 'failure', 'waste'].includes(m.kind)) continue;
      const x = use.get(f.id) ?? { filamentId: f.id, name: `${f.material} ${f.color}`, hex: f.hex, grams: 0 };
      x.grams += -m.grams; used += -m.grams; if (m.kind !== 'consumption') lost += -m.grams;
      use.set(f.id, x);
    }
  }
  const runs = (await listPrintRuns(ex, ctx)).filter((r) => r.on >= from && r.on <= to);
  const printers = await listPrinters(ex, ctx);
  const kwh = (settings?.kwhPriceCents ?? 0) / 100;
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const products = await listProducts(ex, ctx);
  const st = await loadStock(ex, ctx, products);
  const c = await loadCostingContext(ex, ctx, supplyIdsOf(products));
  let pieces = 0; let free = 0; let reserved = 0; let atCost = 0; let atList = 0;
  for (const p of products.filter((x) => x.tracksStock)) {
    const physical = st.physical.get(p.id) ?? 0;
    const total = costOf(p, c).total;
    pieces += physical; reserved += Math.min(physical, st.reserved(p.id)); free += st.free(p.id); atCost += physical * total; atList += physical * priceOf(p, c, total);
  }
  let grams = 0; let value = 0; let spoolCount = 0;
  for (const s of spools) { const left = Math.max(0, s.remainingGrams); if (left > 0.05) spoolCount++; grams += left; value += s.grams > 0 ? (left * (s.costCents + s.shippingCents)) / 100 / s.grams : 0; }
  const channels = await listChannels(ex, ctx);
  const orders = await listOrders(ex, ctx, { statuses: ['quoted', 'accepted', 'in_production', 'ready'] });
  const oc = await childrenOf(ex, ctx, 'order', orders.map((o) => o.id));
  const od = orders.map((o) => ({ o, d: orderData(o, oc.items(o.id), oc.payments(o.id), commissionOf(channels, o.channelId)) }));
  const act = od.filter((x) => x.o.status !== 'quoted');
  const quotes = od.filter((x) => x.o.status === 'quoted');
  return {
    workshop: {
      filaments: [...use.values()].sort((a, b) => b.grams - a.grams).map((x) => ({ ...x, grams: round1(x.grams) })), usedGrams: round1(used), lostGrams: round1(lost),
      runs: runs.length, failures: runs.filter((r) => r.result === 'fail').length, failurePct: settings?.failurePct ?? 0,
      printers: printers.map((p) => {
        const xs = runs.filter((r) => r.printerId === p.id);
        return { id: p.id, name: p.name, runs: xs.length, hours: round1(xs.reduce((a, r) => a + r.hours, 0)), failures: xs.filter((r) => r.result === 'fail').length, costPerHourCents: cents((p.lifeHours ? p.costCents / 100 / p.lifeHours : 0) + p.maintenanceCentsPerHour / 100 + p.kw * kwh) };
      }),
    },
    inventory: { pieces, free, reserved, atCostCents: cents(atCost), atListCents: cents(atList), grams: round1(grams), valueCents: cents(value), spools: spoolCount },
    ordersNow: {
      active: act.length, inProduction: act.filter((x) => x.o.status === 'in_production').length, ready: act.filter((x) => x.o.status === 'ready').length,
      totalCents: cents(act.reduce((a, x) => a + orderTotal(x.d), 0)), paidCents: cents(act.reduce((a, x) => a + orderPaid(x.d), 0)), owedCents: cents(act.reduce((a, x) => a + orderOwed(x.d), 0)),
      profitCents: cents(act.reduce((a, x) => a + orderProfit(x.d), 0)), quotes: quotes.length, quotesCents: cents(quotes.reduce((a, x) => a + orderTotal(x.d), 0)),
    },
    owedByCustomer: (id: string) => act.filter((x) => x.o.customerId === id).reduce((a, x) => a + orderOwed(x.d), 0),
    hexesOf: (productId: string) => (products.find((p) => p.id === productId)?.filaments ?? []).map((f) => c.filaments.get(f.filamentId)?.hex ?? '#c9c9d1'),
  };
}

export async function report(deps: Deps, ex: Executor, ctx: Ctx, q: { period?: '7' | '30' | '90' | 'all' | undefined; from?: string | undefined; to?: string | undefined }) {
  const today = deps.clock.today();
  const { channels, data } = await allSales(ex, ctx);
  const live = data.filter((s) => !s.returned);
  let from: string; let to = today;
  if (q.from && q.to) { from = q.from; to = q.to; }
  else if (q.period === 'all') from = live.length ? live.map((s) => s.on).sort()[0]! < today ? live.map((s) => s.on).sort()[0]! : today : addDays(today, -29);
  else from = addDays(today, -(Number(q.period ?? '30') - 1));
  const days = daysBetween(from, to) + 1;
  const inR = (on: string, a: string, b: string) => on >= a && on <= b;
  const period = data.filter((s) => inR(s.on, from, to));
  const prev = q.period === 'all' ? null : data.filter((s) => inR(s.on, addDays(from, -days), addDays(from, -1)));
  const extra = (list: typeof data) => {
    const ok = list.filter((s) => !s.returned);
    return { count: list.length, list: ok.reduce((a, s) => a + s.items.reduce((x, it) => x + it.qty * it.list, 0), 0), discount: ok.reduce((a, s) => a + s.items.reduce((x, it) => x + Math.max(0, it.qty * it.list - it.qty * it.price), 0), 0) };
  };
  const products = await listProducts(ex, ctx, { withDeleted: true });
  const names = new Map(products.map((p) => [p.id, p.name]));
  const customers = new Map((await listCustomers(ex, ctx, { withDeleted: true })).map((c) => [c.id, c.name]));
  const exps = await listExpenses(ex, ctx);
  const expensesCents = cents(expensesInRange(exps.map(expenseData), from, to));
  const T = salesTotals(period);
  // Buckets: days up to 10, weeks up to 100, months beyond (mockup).
  const unit = days <= 10 ? 'day' : days <= 100 ? 'week' : 'month';
  const buckets: { from: string; to: string; partial: boolean; incomeCents: number; costCents: number; commissionCents: number; profitCents: number; count: number; pieces: number }[] = [];
  for (let s = from; s <= to;) {
    let e = s;
    if (unit === 'week') { const wd = (new Date(`${s}T12:00:00Z`).getUTCDay() + 6) % 7; e = addDays(s, 6 - wd); }
    if (unit === 'month') { while (e < to && addDays(e, 1).slice(0, 7) === s.slice(0, 7)) e = addDays(e, 1); }
    const end = e > to ? to : e;
    const xs = period.filter((x) => inR(x.on, s, end));
    const t = salesTotals(xs);
    buckets.push({ from: s, to: end, partial: e > to || (unit === 'month' && addDays(end, 1).slice(0, 7) === s.slice(0, 7)), incomeCents: cents(t.income), costCents: cents(t.cost), commissionCents: cents(t.commission), profitCents: cents(t.profit), count: xs.length, pieces: t.pieces });
    s = addDays(end, 1);
  }
  const byCollection = new Map<string, { id: string; name: string; qty: number; income: number; cost: number; profit: number }>();
  for (const s of period.filter((x) => !x.returned)) for (const it of s.items) {
    if (it.kind !== 'set' || !it.collectionId) continue;
    const x = byCollection.get(it.collectionId) ?? { id: it.collectionId, name: it.name, qty: 0, income: 0, cost: 0, profit: 0 };
    x.qty += it.qty; x.income += it.qty * it.price; x.cost += it.qty * it.cost; x.profit += it.qty * it.price * (1 - s.commissionPct / 100) - it.qty * it.cost;
    byCollection.set(it.collectionId, x);
  }
  const byCustomer = new Map<string, { id: string | null; name: string; count: number; income: number; profit: number; owed: number }>();
  for (const s of period) {
    const k = s.customerId ?? '';
    const x = byCustomer.get(k) ?? { id: s.customerId, name: s.customerId ? customers.get(s.customerId) ?? '' : '', count: 0, income: 0, profit: 0, owed: 0 };
    const t = salesTotals([s]); x.count += 1; x.income += t.income; x.profit += t.profit; x.owed += s.customerId ? saleOwed(s) : 0;
    byCustomer.set(k, x);
  }
  // Cost concepts: each sold line split by the current breakdown of its piece.
  const c = await loadCostingContext(ex, ctx, supplyIdsOf(products));
  const byId = new Map(products.map((p) => [p.id, p]));
  const k = { M: 0, L: 0, Q: 0, E: 0, F: 0 };
  for (const s of period.filter((x) => !x.returned)) for (const it of s.items) for (const l of itemLines(it)) {
    const p = byId.get(l.productId);
    const b = p ? costOf(p, c) : null;
    if (b && b.total > 0) for (const key of ['M', 'L', 'Q', 'E', 'F'] as const) k[key] += (l.cost * b[key]) / b.total;
    else k.E += l.cost;
  }
  const g = await grossProfitAndExpenses(ex, ctx, today);
  const printers = await listPrinters(ex, ctx);
  const inv = investmentRecovered(g.grossProfit, g.expenses, printers.map((p) => ({ id: p.id, costPesos: p.costCents / 100, hours: p.hours })));
  const W = await reportWorkshopAndState(ex, ctx, from, to);
  const prevExpensesCents = prev ? cents(expensesInRange(exps.map(expenseData), addDays(from, -days), addDays(from, -1))) : null;
  return {
    range: { from, to, days, unit, period: q.from && q.to ? 'custom' : q.period ?? '30' },
    totals: totalsView(T, extra(period)), previous: prev ? totalsView(salesTotals(prev), extra(prev)) : null,
    byChannel: channels.map((ch) => { const xs = period.filter((s) => s.channelId === ch.id); return { channelId: ch.id, name: ch.name, commissionPct: ch.commissionPct, ...totalsView(salesTotals(xs), extra(xs)) }; }).filter((x) => x.count > 0),
    topProducts: rankProducts(period, (id) => names.get(id)).map((r) => ({ productId: r.productId, name: r.name, hexes: W.hexesOf(r.productId), qty: r.qty, incomeCents: cents(r.income), costCents: cents(r.cost), profitCents: cents(r.profit), times: Math.round(r.times * 10) / 10 })),
    byCollection: [...byCollection.values()].sort((a, b) => b.profit - a.profit).map((x) => ({ id: x.id, name: x.name, qty: x.qty, incomeCents: cents(x.income), costCents: cents(x.cost), profitCents: cents(x.profit) })),
    byCustomer: [...byCustomer.values()].sort((a, b) => b.income - a.income).map((x) => ({ id: x.id, name: x.name, count: x.count, incomeCents: cents(x.income), profitCents: cents(x.profit), owedCents: x.id ? cents(x.owed + W.owedByCustomer(x.id)) : 0 })),
    costConcepts: { materialCents: cents(k.M), powerCents: cents(k.L), machineCents: cents(k.Q), extrasCents: cents(k.E), failureReserveCents: cents(k.F) },
    buckets, expensesCents, netProfitCents: cents(T.profit) - expensesCents,
    investmentRecovered: { equipmentCents: cents(inv.equipment), hours: inv.hours, netCents: cents(inv.net), recoveredPct: Math.round(inv.recoveredPct * 10) / 10 },
    periodSales: period.length,
    hasExpenses: exps.length > 0, previousExpensesCents: prevExpensesCents,
    workshop: W.workshop, inventory: W.inventory, ordersNow: W.ordersNow,
  };
}

// ---------- Compras (docs/04 §9) ----------
export async function purchases(_deps: Deps, ex: Executor, ctx: Ctx) {
  const suppliers = await listSuppliers(ex, ctx);
  const supplies = (await listSupplies(ex, ctx, { page: 1, pageSize: 100_000 })).items;
  const fils = await listAllFilaments(ex, ctx);
  const spools = await listSpools(ex, ctx, fils.map((f) => f.id));
  const products = new Map((await listProducts(ex, ctx)).map((p) => [p.id, p]));
  const orders = (await listOrders(ex, ctx, { statuses: ['accepted'] })).filter((o) => !o.filamentDeducted);
  const ch = await childrenOf(ex, ctx, 'order', orders.map((o) => o.id));
  const needed: Record<string, number> = {};
  const neededBy: Record<string, number[]> = {};
  const purge = (await getSettings(ex, ctx))?.purgePct ?? 0;
  for (const o of orders) {
    const own: Record<string, number> = {};
    for (const it of ch.items(o.id)) {
      const d = lineItemData(it);
      for (const [f, gr] of Object.entries(itemMaterial(d, (id) => products.get(id)?.filaments ?? []))) own[f] = (own[f] ?? 0) + gr * (1 + purge / 100);
    }
    for (const [f, gr] of Object.entries(own)) { needed[f] = (needed[f] ?? 0) + gr; (neededBy[f] ??= []).push(o.number); }
  }
  const brandSupplier = (brand: string) => suppliers.find((s) => brand && s.brands.split(',').map((b) => normalizeName(b)).includes(normalizeName(brand)))?.id ?? null;
  const lines = [
    ...fils.map((f) => {
      const own = spools.filter((s) => s.filamentId === f.id);
      const last = [...own].sort((a, b) => (a.purchasedOn + a.id).localeCompare(b.purchasedOn + b.id)).at(-1);
      const remaining = own.reduce((a, s) => a + Math.max(0, s.remainingGrams), 0);
      const line = filamentPurchase({
        id: f.id, hasSpools: own.length > 0, remaining, neededByOrders: needed[f.id] ?? 0,
        lastSpool: last ? { grams: last.grams, costPlusShipping: (last.costCents + last.shippingCents) / 100 } : null, supplierId: last ? brandSupplier(last.brand) : null,
      });
      // Mockup urgency: an order waiting for it first, then 150 g or less left.
      const urgency = line?.reason === 'order' ? 2 : remaining <= 150 ? 1 : 0;
      return line && {
        ...line, name: `${f.material} ${f.color}`, hex: f.hex, unit: 'rollo', brand: last?.brand ?? '', missingGrams: Math.max(0, Math.round(((needed[f.id] ?? 0) - remaining) * 10) / 10),
        remainingGrams: Math.round(remaining * 10) / 10, orderNumbers: line.reason === 'order' ? neededBy[f.id] ?? [] : [], urgency, urgent: urgency === 2,
      };
    }),
    ...supplies.map((s) => {
      const line = supplyPurchase({ id: s.id, stock: s.stock, minimum: s.minimum, unitCost: s.costCents / 100, supplierId: s.supplierId });
      const urgency = s.stock <= 0 ? 2 : 0;
      return line && { ...line, name: s.name, hex: null, unit: s.unit, brand: '', missingGrams: 0, stock: s.stock, minimum: s.minimum, remainingGrams: 0, orderNumbers: [] as number[], urgency, urgent: urgency === 2 };
    }),
  ].filter((x): x is NonNullable<typeof x> => !!x).sort((a, b) => b.urgency - a.urgency);
  // Groups in the order the suppliers were added (ids are time-ordered), like the mockup; no supplier last.
  const order = [...[...suppliers].sort((a, b) => a.id.localeCompare(b.id)).map((s) => s.id as string | null), null];
  const groups = order.filter((sid) => lines.some((l) => l.supplierId === sid)).map((sid) => {
    const sup = sid ? suppliers.find((s) => s.id === sid) : undefined;
    const ls = lines.filter((l) => l.supplierId === sid);
    return { supplierId: sid, supplier: sup ? { id: sup.id, name: sup.name, phone: sup.phone, note: sup.note } : null, lines: ls.map((l) => ({ ...l, estimatedCents: cents(l.estimated) })), estimatedCents: cents(ls.reduce((a, l) => a + l.estimated, 0)) };
  });
  // Latest purchases (mockup "Últimas compras"): spools and supply purchases, newest first. The first movement of a supply is its initial stock, not a purchase.
  const filName = new Map(fils.map((f) => [f.id, `${f.material} ${f.color}`]));
  const supplyBuys = (await Promise.all(supplies.map(async (s) => {
    const ms = await listSupplyMovements(ex, ctx, s.id);
    const first = ms.at(-1);
    return ms.filter((m) => m.kind === 'purchase' && m !== first).map((m) => ({ kind: 'supply' as const, id: s.id, on: m.on, name: s.name, brand: '', qty: m.qty, unit: s.unit, amountCents: Math.round(m.qty * s.costCents) }));
  }))).flat();
  const recent = [
    ...spools.map((sp) => ({ kind: 'filament' as const, id: sp.filamentId, on: sp.purchasedOn, name: filName.get(sp.filamentId) ?? '', brand: sp.brand, qty: 1, unit: 'rollo', amountCents: sp.costCents + sp.shippingCents })),
    ...supplyBuys,
  ].sort((a, b) => b.on.localeCompare(a.on)).slice(0, 6);
  return { groups, estimatedCents: groups.reduce((a, g) => a + g.estimatedCents, 0), count: lines.length, urgent: lines.filter((l) => l.urgent).length, recent };
}

// ---------- Inicio (docs/06 §2) ----------
export async function home(deps: Deps, ex: Executor, ctx: Ctx) {
  const today = deps.clock.today();
  const { data, rows } = await allSales(ex, ctx);
  const last30 = data.filter((s) => inPeriod(s.on, today, 30));
  const t = salesTotals(last30);
  const channels = await listChannels(ex, ctx);
  const orders = await listOrders(ex, ctx);
  const oc = await childrenOf(ex, ctx, 'order', orders.map((o) => o.id));
  const customers = new Map((await listCustomers(ex, ctx, { withDeleted: true })).map((c) => [c.id, c.name]));
  const od = orders.map((o) => ({ o, d: orderData(o, oc.items(o.id), oc.payments(o.id), commissionOf(channels, o.channelId)) }));
  const active = od.filter((x) => isActive(x.o.status as OrderStatus));
  const printers = await listPrinters(ex, ctx);
  const queues = await queueViews(ex, ctx, { printerIds: printers.map((p) => p.id) }, deps.clock.now());
  const attentions: { kind: string; severity: 'bad' | 'warn' | 'info'; target: { type: string; id: string | null }; params: Record<string, unknown> }[] = [];
  const products = await listProducts(ex, ctx);
  const fils = await listAllFilaments(ex, ctx);
  const spools = await listSpools(ex, ctx, fils.map((f) => f.id));
  const purge = (await getSettings(ex, ctx))?.purgePct ?? 0;
  const byId = new Map(products.map((p) => [p.id, p]));
  const filName = (id: string) => { const f = fils.find((x) => x.id === id); return f ? `${f.material} ${f.color}` : ''; };
  const left = (id: string) => spools.filter((s) => s.filamentId === id).reduce((a, s) => a + Math.max(0, s.remainingGrams), 0);
  for (const { o } of active.filter((x) => x.o.status === 'accepted' && !x.o.filamentDeducted)) {
    const need: Record<string, number> = {};
    for (const it of oc.items(o.id)) for (const [f, gr] of Object.entries(itemMaterial(lineItemData(it), (id) => byId.get(id)?.filaments ?? []))) need[f] = (need[f] ?? 0) + gr * (1 + purge / 100);
    for (const [f, gr] of Object.entries(need)) if (gr > left(f) + 0.01) attentions.push({ kind: 'order_filament_short', severity: 'bad', target: { type: 'order', id: o.id }, params: { number: o.number, filament: filName(f), filamentId: f, missingGrams: Math.round((gr - left(f)) * 10) / 10, availableGrams: Math.round(left(f) * 10) / 10, customer: customers.get(o.customerId) ?? '' } });
  }
  for (const f of fils) { const own = spools.filter((s) => s.filamentId === f.id); if (own.length && left(f.id) <= 150) attentions.push({ kind: 'filament_low', severity: left(f.id) <= 0.5 ? 'bad' : 'warn', target: { type: 'filament', id: f.id }, params: { name: filName(f.id), grams: Math.round(left(f.id)) } }); }
  for (const { o } of [...active].sort((x, y) => x.o.dueOn.localeCompare(y.o.dueOn))) { const d = daysBetween(today, o.dueOn); if (d <= 2) attentions.push({ kind: 'order_due', severity: d < 0 ? 'bad' : 'warn', target: { type: 'order', id: o.id }, params: { number: o.number, customer: customers.get(o.customerId) ?? '', days: d, dueOn: o.dueOn, status: o.status } }); }
  for (const [i, s] of [...data.entries()].sort((x, y) => x[1].on.localeCompare(y[1].on))) { const owed = saleOwed(s); if (owed > 0) attentions.push({ kind: 'sale_owed', severity: 'info', target: { type: 'sale', id: s.id }, params: { customer: rows[i]!.customerId ? customers.get(rows[i]!.customerId!) ?? '' : '', owedCents: cents(owed), on: s.on } }); }
  const c = await loadCostingContext(ex, ctx, supplyIdsOf(products));
  for (const p of products) {
    if (p.mode !== 'value' || !p.priceCents) continue;
    const floor = floorPrice(costOf(p, c).total, c.settings.minMarginPct);
    if (p.priceCents / 100 < floor - 0.005) attentions.push({ kind: 'price_below_floor', severity: 'warn', target: { type: 'product', id: p.id }, params: { name: p.name, priceCents: p.priceCents, floorCents: cents(floor), costCents: cents(costOf(p, c).total) } });
  }
  for (const col of await listCollections(ex, ctx)) {
    if (!col.priceCents) continue;
    const parts = setPartsOf(col, byId, c);
    const floor = floorPrice(setCost(parts, col.extrasCents / 100), c.settings.minMarginPct);
    if (setPrice(col.priceCents / 100, parts) < floor - 0.005) attentions.push({ kind: 'price_below_floor', severity: 'warn', target: { type: 'collection', id: col.id }, params: { name: col.name, priceCents: col.priceCents, floorCents: cents(floor), costCents: cents(setCost(parts, col.extrasCents / 100)) } });
  }
  const tasks = await listTasks(ex, ctx, printers.map((p) => p.id));
  const maint = tasks.map((tk) => { const p = printers.find((x) => x.id === tk.printerId)!; return { tk, p, s: maintenanceState({ everyHours: tk.everyHours, lastHours: tk.lastHours }, p.hours) }; })
    .filter((x) => x.s.status !== 'ok').sort((a, b) => a.s.remaining - b.s.remaining).slice(0, 3);
  for (const m of maint) attentions.push({ kind: 'maintenance', severity: m.s.status === 'due' ? 'bad' : 'warn', target: { type: 'printer', id: m.p.id }, params: { printer: m.p.name, task: m.tk.task, status: m.s.status, remainingHours: Math.round(m.s.remaining * 10) / 10 } });
  for (const s of (await listSupplies(ex, ctx, { page: 1, pageSize: 100_000 })).items) if (s.stock <= s.minimum) attentions.push({ kind: 'supply_low', severity: s.stock <= 0 ? 'bad' : 'warn', target: { type: 'supply', id: s.id }, params: { name: s.name, stock: s.stock, minimum: s.minimum, unit: s.unit } });
  const backup = (await getSettings(ex, ctx))?.lastBackupOn ?? null;
  if (!backup || daysBetween(backup, today) > 7) attentions.push({ kind: 'backup', severity: 'warn', target: { type: 'settings', id: null }, params: { lastOn: backup, days: backup ? daysBetween(backup, today) : null } });
  const printingNow = printers.flatMap((p) => (queues.get(p.id) ?? []).filter((q) => q.startedAt).slice(0, 1).map((q) => ({ printerId: p.id, printer: p.name, ...q, customer: customers.get(orders.find((o) => o.id === q.orderId)?.customerId ?? '') ?? '' })));
  return {
    stats: {
      incomeCents: cents(t.income), profitCents: cents(t.profit), marginPct: Math.round(t.marginPct * 10) / 10, sales: last30.length, pieces: t.pieces,
      activeOrders: active.length, owedCents: cents(active.reduce((a, x) => a + orderOwed(x.d), 0) + data.reduce((a, s) => a + saleOwed(s), 0)),
      inProduction: active.filter((x) => x.o.status === 'in_production').length, ready: active.filter((x) => x.o.status === 'ready').length,
      printersBusy: printingNow.length, printers: printers.length, products: products.length,
    },
    printingNow, attentions,
    upcoming: active.sort((a, b) => a.o.dueOn.localeCompare(b.o.dueOn)).slice(0, 6).map(({ o, d }) => ({ id: o.id, number: o.number, customer: customers.get(o.customerId) ?? '', status: o.status, dueOn: o.dueOn, itemsText: itemsText(oc.items(o.id)), owedCents: cents(orderOwed(d)) })),
  };
}

// ---------- Búsqueda ----------
export async function search(_deps: Deps, ex: Executor, ctx: Ctx, q: string) {
  const needle = normalizeName(q);
  const hit = (...t: (string | null | undefined)[]) => t.some((x) => x && normalizeName(x).includes(needle));
  const productsAll = await listProducts(ex, ctx);
  const c = await loadCostingContext(ex, ctx, supplyIdsOf(productsAll));
  const products = productsAll.filter((p) => hit(p.name, p.note, ...p.tags)).slice(0, 8).map((p) => ({ id: p.id, name: p.name, listCents: cents(priceOf(p, c)) }));
  const byId = new Map(productsAll.map((p) => [p.id, p]));
  const collections = (await listCollections(ex, ctx)).filter((col) => hit(col.name)).slice(0, 8).map((col) => ({ id: col.id, name: col.name, priceCents: cents(setPrice(col.priceCents ? col.priceCents / 100 : null, setPartsOf(col, byId, c))) }));
  const customersAll = await listCustomers(ex, ctx);
  const customers = customersAll.filter((x) => hit(x.name, x.phone, x.note)).slice(0, 8).map((x) => ({ id: x.id, name: x.name, type: x.type, phone: x.phone }));
  const cname = new Map((await listCustomers(ex, ctx, { withDeleted: true })).map((x) => [x.id, x.name]));
  const ordersAll = await listOrders(ex, ctx);
  const oc = await childrenOf(ex, ctx, 'order', ordersAll.map((o) => o.id));
  const orders = ordersAll.filter((o) => hit(`#${o.number}`, String(o.number), o.note, cname.get(o.customerId), itemsText(oc.items(o.id)))).slice(0, 8).map((o) => ({ id: o.id, number: o.number, customer: cname.get(o.customerId) ?? '', status: o.status, itemsText: itemsText(oc.items(o.id)) }));
  const salesAll = [...await listSales(ex, ctx)].sort((a, b) => b.on.localeCompare(a.on));
  const sc = await childrenOf(ex, ctx, 'sale', salesAll.map((s) => s.id));
  const sales = salesAll.filter((s) => hit(s.note, cname.get(s.customerId ?? ''), itemsText(sc.items(s.id)))).slice(0, 8).map((s) => ({ id: s.id, on: s.on, itemsText: itemsText(sc.items(s.id)), customer: cname.get(s.customerId ?? '') ?? '', totalCents: cents(saleGross({ items: sc.items(s.id).map(lineItemData) })) }));
  const fils = (await listAllFilaments(ex, ctx)).filter((f) => hit(`${f.material} ${f.color}`)).slice(0, 8);
  const spools = await listSpools(ex, ctx, fils.map((f) => f.id));
  const filaments = fils.map((f) => ({ id: f.id, name: `${f.material} ${f.color}`, hex: f.hex, remainingGrams: Math.round(spools.filter((x) => x.filamentId === f.id).reduce((a, x) => a + Math.max(0, x.remainingGrams), 0) * 10) / 10 }));
  const supplies = (await listSupplies(ex, ctx, { page: 1, pageSize: 100_000 })).items.filter((x) => hit(x.name, x.note)).slice(0, 8).map((x) => ({ id: x.id, name: x.name, stock: x.stock, unit: x.unit }));
  return { products, collections, customers, orders, sales, filaments, supplies };
}
