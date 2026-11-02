// Sales (docs/04 §6): income, commission, cost, profit, payment and return. Rankings split sets (§13).
import { round2 } from './money';
import { itemCost, itemLines, itemListTotal, itemPieces, itemTotal, type LineItemData } from './line-items';

export interface SaleReturn { on: string; restock: boolean; refund: number; note: string }
export interface SaleData { id: string; items: readonly LineItemData[]; commissionPct: number; payments: readonly number[] | null; returned: SaleReturn | null }

export const saleGross = (s: Pick<SaleData, 'items'>) => s.items.reduce((a, it) => a + itemTotal(it), 0);
export const saleIncome = (s: SaleData) => (s.returned ? 0 : saleGross(s));
export const saleCommission = (s: SaleData) => (saleIncome(s) * s.commissionPct) / 100;
export const saleGrossCost = (s: Pick<SaleData, 'items'>) => s.items.reduce((a, it) => a + itemCost(it), 0);
/** If the pieces went back to stock the cost is not lost; if they were thrown away, it is. */
export const saleCost = (s: SaleData) => (s.returned?.restock ? 0 : saleGrossCost(s));
export const saleProfit = (s: SaleData) => saleIncome(s) - saleCommission(s) - saleCost(s);
export const saleList = (s: SaleData) => (s.returned ? 0 : s.items.reduce((a, it) => a + itemListTotal(it), 0));
export const salePieces = (s: SaleData) => (s.returned ? 0 : s.items.reduce((a, it) => a + itemPieces(it), 0));
/** Without payments recorded, a sale is fully paid (case 6.2). */
export const salePaid = (s: Pick<SaleData, 'items' | 'payments'>) => (s.payments ? s.payments.reduce((a, x) => a + x, 0) : saleGross(s));
export const saleOwed = (s: SaleData) => (s.returned ? 0 : Math.max(0, round2(saleGross(s) - salePaid(s))));

export interface SalesTotals { income: number; commission: number; cost: number; profit: number; pieces: number; marginPct: number }
export function salesTotals(sales: readonly SaleData[]): SalesTotals {
  const t = { income: 0, commission: 0, cost: 0, profit: 0, pieces: 0 };
  for (const s of sales) { t.income += saleIncome(s); t.commission += saleCommission(s); t.cost += saleCost(s); t.profit += saleProfit(s); t.pieces += salePieces(s); }
  return { ...t, marginPct: t.income ? (t.profit / t.income) * 100 : 0 };
}

export interface RankRow { productId: string; name: string; qty: number; income: number; cost: number; profit: number; times: number }
/** Which piece left more: each item is opened into its pieces; returned sales do not count. */
export function rankProducts(sales: readonly SaleData[], nameOf: (productId: string) => string | undefined = () => undefined): RankRow[] {
  const g = new Map<string, RankRow>();
  for (const s of sales) {
    if (s.returned) continue;
    const cm = s.commissionPct / 100;
    for (const it of s.items) for (const l of itemLines(it)) {
      const x = g.get(l.productId) ?? { productId: l.productId, name: nameOf(l.productId) ?? l.name, qty: 0, income: 0, cost: 0, profit: 0, times: 0 };
      x.qty += l.qty; x.income += l.income; x.cost += l.cost; x.profit += l.income * (1 - cm) - l.cost;
      g.set(l.productId, x);
    }
  }
  return [...g.values()].map((x) => ({ ...x, times: x.cost > 0 ? x.income / x.cost : 0 })).sort((a, b) => b.profit - a.profit);
}

/** Pieces sold per product (also inside sets) and sets sold per collection; returned sales do not count. */
export function soldCounts(sales: readonly SaleData[]) {
  const products = new Map<string, number>();
  const collections = new Map<string, number>();
  for (const s of sales) {
    if (s.returned) continue;
    for (const it of s.items) {
      for (const l of itemLines(it)) products.set(l.productId, (products.get(l.productId) ?? 0) + l.qty);
      if (it.kind === 'set' && it.collectionId) collections.set(it.collectionId, (collections.get(it.collectionId) ?? 0) + it.qty);
    }
  }
  return { products, collections };
}
