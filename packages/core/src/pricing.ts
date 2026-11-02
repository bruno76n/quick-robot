/**
 * Prices (docs/04 §3) — mockup `sugerido`, `piso`, `margenDe`, `precioDe`, `sueltas`, `precioCol`, `costoCol`, `nice`.
 */

/** suggested(total, margin, commission) = total / (1 − margin/100 − commission/100). */
export function suggestedPrice(total: number, marginPct: number, commissionPct = 0): number {
  return total / (1 - marginPct / 100 - commissionPct / 100);
}

/** floor(total) = total / (1 − minimum margin/100). */
export function floorPrice(total: number, minMarginPct: number): number {
  return total / (1 - minMarginPct / 100);
}

/** A piece's margin is its own or, if it has none, the global formula margin. */
export function effectiveMargin(pieceMarginPct: number | null | undefined, formulaMarginPct: number): number {
  return pieceMarginPct == null ? formulaMarginPct : pieceMarginPct;
}

export type PriceMode = 'value' | 'formula';

/** List price: "formula" → ceil(suggested(cost, min(95, margin))); "value" → the price the person wrote. */
export function listPrice(o: { mode: PriceMode; price: number; cost: number; marginPct: number }): number {
  return o.mode === 'formula' ? Math.ceil(suggestedPrice(o.cost, Math.min(95, o.marginPct))) : o.price || 0;
}

/** Profit of selling at `price` through a channel: price − commission − cost. */
export function channelProfit(price: number, cost: number, commissionPct: number): number {
  return price - (price * commissionPct) / 100 - cost;
}

/** Margin over price, in % (0 when there is no price). */
export function marginPct(price: number, cost: number): number {
  return price > 0 ? ((price - cost) / price) * 100 : 0;
}

/** Friendly rounding used by the price shortcuts (mockup `nice`). */
export function nicePrice(v: number): number {
  if (v < 20) return Math.ceil(v);
  if (v < 200) return Math.ceil(v / 5) * 5;
  return Math.ceil(v / 10) * 10;
}

/** Quantity of a part in a set: a whole number, at least 1 (mockup `cantParte`). */
export function partQty(qty: number): number {
  return Math.max(1, Math.round(Number.isFinite(qty) ? qty : 1));
}

export interface SetPart {
  qty: number;
  listPrice: number;
  cost: number;
}

/** "Sueltas" = Σ list price × qty. */
export function loosePrice(parts: readonly Pick<SetPart, 'qty' | 'listPrice'>[]): number {
  return parts.reduce((t, p) => t + p.listPrice * partQty(p.qty), 0);
}

/** Set price = the written price; empty or 0 → the loose price. */
export function collectionPrice(price: number | null | undefined, loose: number): number {
  return price != null && price > 0 ? price : loose;
}

/** Set cost = Σ cost × qty + set extras. */
export function collectionCost(parts: readonly Pick<SetPart, 'qty' | 'cost'>[], extras: number): { pieces: number; extras: number; total: number } {
  const pieces = parts.reduce((t, p) => t + p.cost * partQty(p.qty), 0);
  return { pieces, extras: extras || 0, total: pieces + (extras || 0) };
}

/**
 * Split of a set price among its pieces (rankings and breakdown):
 * each piece gets setPrice × (list × qty) / Σ(list × qty). Extras cost is split the same way.
 */
export function splitSet(setPrice: number, parts: readonly Pick<SetPart, 'qty' | 'listPrice'>[], extrasCost = 0): { price: number; extras: number }[] {
  const weights = parts.map((p) => p.listPrice * partQty(p.qty));
  const total = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => (total > 0 ? { price: (setPrice * w) / total, extras: (extrasCost * w) / total } : { price: setPrice / parts.length, extras: extrasCost / parts.length }));
}
