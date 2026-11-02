// Line items of a sale or an order (docs/04 §4). A piece or a set, with the photo of the moment:
// price charged, list price and cost; sets also keep the parts they had that day.

export interface ItemPart { productId: string; name: string; qty: number; list: number; cost: number }
export interface LineItemData {
  kind: 'piece' | 'set';
  productId?: string | null;
  collectionId?: string | null;
  name: string;
  qty: number;
  /** Unit price charged, list price and unit cost, in pesos (frozen). */
  price: number;
  list: number;
  cost: number;
  /** Set extras per set (frozen). */
  extras?: number;
  parts?: readonly ItemPart[];
  /** Orders only: how many of each piece come from the shelf. */
  fromStock?: Readonly<Record<string, number>>;
}

export const itemTotal = (it: LineItemData) => it.qty * it.price;
export const itemCost = (it: LineItemData) => it.qty * it.cost;
export const itemListTotal = (it: LineItemData) => it.qty * it.list;

/** Pieces that form the item: the piece itself, or each part × the number of sets. */
export function itemParts(it: LineItemData): { productId: string; qty: number }[] {
  if (it.kind === 'set') return (it.parts ?? []).map((p) => ({ productId: p.productId, qty: p.qty * it.qty }));
  return it.productId ? [{ productId: it.productId, qty: it.qty }] : [];
}
export const itemPieces = (it: LineItemData) => itemParts(it).reduce((a, p) => a + p.qty, 0);

/** Pieces needed per product. */
export function itemNeed(it: LineItemData): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of itemParts(it)) out[p.productId] = (out[p.productId] ?? 0) + p.qty;
  return out;
}

/** What is printed: the need minus what comes from the shelf (case 4.1). */
export function itemToPrint(it: LineItemData): Record<string, number> {
  const out: Record<string, number> = {};
  const need = itemNeed(it);
  for (const [id, n] of Object.entries(need)) {
    const k = n - Math.min(n, Math.max(0, it.fromStock?.[id] ?? 0));
    if (k > 0) out[id] = k;
  }
  return out;
}
const sumValues = (o: Readonly<Record<string, number>>) => Object.values(o).reduce((a, b) => a + b, 0);
export const itemToPrintCount = (it: LineItemData) => sumValues(itemToPrint(it));
export const itemFromStockCount = (it: LineItemData) => itemPieces(it) - itemToPrintCount(it);

/** Hours of printing of the part that is printed. */
export function itemHours(it: LineItemData, hoursOf: (productId: string) => number): number {
  return Object.entries(itemToPrint(it)).reduce((a, [id, n]) => a + hoursOf(id) * n, 0);
}

/** Grams of filament of the part that is printed, per filament. */
export function itemMaterial(it: LineItemData, filamentsOf: (productId: string) => readonly { filamentId: string; grams: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, n] of Object.entries(itemToPrint(it))) for (const f of filamentsOf(id)) out[f.filamentId] = (out[f.filamentId] ?? 0) + f.grams * n;
  return out;
}

export interface ItemLine { productId: string; name: string; qty: number; income: number; cost: number }

/** A set is split among its pieces by list price, so each piece counts its share in rankings (docs/04 §3, §13). */
export function itemLines(it: LineItemData): ItemLine[] {
  const parts = it.parts ?? [];
  if (it.kind !== 'set' || !parts.length) return [{ productId: (it.productId ?? it.collectionId)!, name: it.name, qty: itemPieces(it) || it.qty, income: itemTotal(it), cost: itemCost(it) }];
  const total = itemTotal(it);
  const w = parts.map((p) => Math.max(0, p.list) * p.qty);
  const W = w.reduce((a, b) => a + b, 0);
  const ext = (it.extras ?? 0) * it.qty;
  return parts.map((p, i) => {
    const share = W > 0 ? w[i]! / W : 1 / parts.length;
    return { productId: p.productId, name: p.name, qty: p.qty * it.qty, income: total * share, cost: p.qty * it.qty * p.cost + ext * share };
  });
}
