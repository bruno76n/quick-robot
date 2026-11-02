// Prices (docs/04 §3): suggested, floor, list price, sets and how a set price is split among its pieces.

export const MAX_FORMULA_MARGIN = 95;

export function suggestedPrice(total: number, marginPct: number, commissionPct = 0): number {
  return total / (1 - marginPct / 100 - commissionPct / 100);
}

/** Lowest price that keeps the minimum margin. */
export function floorPrice(total: number, minMarginPct: number): number {
  return total / (1 - minMarginPct / 100);
}

/** The piece's own margin or, if it has none, the global formula margin. */
export function effectiveMargin(productMarginPct: number | null | undefined, formulaMarginPct: number): number {
  return productMarginPct === null || productMarginPct === undefined || Number.isNaN(productMarginPct) ? formulaMarginPct : productMarginPct;
}

export type PriceMode = 'value' | 'formula';

/** List price: in "formula" mode ceil(suggested(total, min(95, margin))); in "value" mode what the person typed. */
export function listPrice(mode: PriceMode, total: number, marginPct: number, typedPrice: number): number {
  return mode === 'formula' ? Math.ceil(suggestedPrice(total, Math.min(MAX_FORMULA_MARGIN, marginPct))) : typedPrice || 0;
}

/** Friendly rounding used by the price shortcuts of the calculator (mockup `nice`). */
export function nicePrice(v: number): number {
  if (v < 20) return Math.ceil(v);
  if (v < 200) return Math.ceil(v / 5) * 5;
  return Math.ceil(v / 10) * 10;
}

export interface SetPart { productId: string; qty: number; listPrice: number; cost: number }

/** Quantity of a part: at least 1, whole. */
export const partQty = (q: number) => Math.max(1, Math.round(Number.isFinite(q) ? q : 1));

/** What the parts would cost sold loose at their list price. */
export function looseSum(parts: readonly SetPart[]): number {
  return parts.reduce((a, p) => a + p.listPrice * partQty(p.qty), 0);
}

/** The set costs what was typed; empty or 0 means the loose sum (case 3.2). */
export function setPrice(typed: number | null | undefined, parts: readonly SetPart[]): number {
  return typed && typed > 0 ? typed : looseSum(parts);
}

export function setCost(parts: readonly SetPart[], extras: number): number {
  return parts.reduce((a, p) => a + p.cost * partQty(p.qty), 0) + (extras || 0);
}

/** Each piece receives price × (list × qty) / Σ(list × qty) (case 3.3). Extras are split the same way. */
export function splitSetPrice(price: number, parts: readonly SetPart[]): { productId: string; amount: number }[] {
  const base = looseSum(parts);
  return parts.map((p) => ({ productId: p.productId, amount: base > 0 ? (price * p.listPrice * partQty(p.qty)) / base : 0 }));
}

/** Profit of selling at `price` through a channel: price − commission − cost. */
export function profitAt(price: number, total: number, commissionPct: number): { commission: number; profit: number; marginPct: number } {
  const commission = (price * commissionPct) / 100;
  const profit = price - commission - total;
  return { commission, profit, marginPct: price > 0 ? (profit / price) * 100 : 0 };
}
