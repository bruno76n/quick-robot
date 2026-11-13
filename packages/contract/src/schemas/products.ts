// Pieces and collections (docs/12 §5).
import { z } from 'zod';
import { cents, grams, id, LIMITS, name, note, pct } from './common';

const tag = z.string().trim().min(1).max(LIMITS.short);
export const productSpec = z.object({
  layer: z.string().max(LIMITS.short), infill: z.string().max(LIMITS.short), walls: z.string().max(LIMITS.short), supports: z.string().max(LIMITS.short),
  nozzle: z.string().max(LIMITS.short), bed: z.string().max(LIMITS.short), file: z.string().max(LIMITS.name * 2), note: z.string().max(LIMITS.note),
}).partial();

export const saveProductInput = z.object({
  name, tags: z.array(tag).max(LIMITS.tagsPerProduct).default([]), mode: z.enum(['value', 'formula']),
  priceCents: cents(LIMITS.unitPriceCents).optional(), marginPct: pct.nullable().optional(), printerId: id.nullable().optional(),
  hours: z.number().min(0).max(LIMITS.hours), batchSize: z.number().int().min(1).max(10_000).default(1), extrasCents: cents(LIMITS.unitPriceCents).default(0),
  tracksStock: z.boolean().default(false),
  filaments: z.array(z.object({ filamentId: id, grams: grams(LIMITS.movementGrams) })).max(LIMITS.filamentsPerProduct).default([]),
  supplies: z.array(z.object({ supplyId: id, qty: z.number().min(0).max(LIMITS.qtyPerItem) })).max(LIMITS.suppliesPerProduct).default([]),
  spec: productSpec.nullable().optional(), note: note.default(''), photoFileId: id.nullable().optional(),
  /** Only for a variant (PUT): its label. Ignored for an original. */
  variantLabel: z.string().trim().min(1).max(60).nullable().optional(),
});

/** A variant label: 1–60 letters (mejoras/ronda-2.md §3.1); required to create a variant. */
export const variantLabel = z.string().trim().min(1).max(60);
export const saveProductAsVariantInput = saveProductInput.extend({ variantLabel });

export const breakdown = z.object({ materialCents: z.number().int(), powerCents: z.number().int(), machineCents: z.number().int(), extrasCents: z.number().int(), failureReserveCents: z.number().int(), costCents: z.number().int() });
export const productListItem = z.object({
  id, name: z.string(), tags: z.array(z.string()), parentId: id.nullable(), photoUrl: z.string().nullable(), costCents: z.number().int(),
  listCents: z.number().int(), floorCents: z.number().int(), tracksStock: z.boolean(), free: z.number(), technical: z.boolean(), mode: z.enum(['value', 'formula']),
  hexes: z.array(z.string()), hours: z.number(), printerId: id.nullable(),
  printerName: z.string().nullable(), parentName: z.string().nullable(), collections: z.array(z.object({ id, name: z.string() })),
  sold: z.number(), physical: z.number(), reserved: z.number(),
  /** "<original> · <label>" for a variant, the name otherwise (what pickers, documents and reports show). */
  displayName: z.string(), variantLabel: z.string().nullable(),
});
export const productDetail = productListItem.extend({
  marginPct: z.number().nullable(), priceCents: z.number().int(), batchSize: z.number().int(), extrasCents: z.number().int(), note: z.string(),
  spec: productSpec.nullable(), photoFileId: id.nullable(),
  filaments: z.array(z.object({ filamentId: id, grams: z.number() })), supplies: z.array(z.object({ supplyId: id, qty: z.number() })),
  breakdown, suggestedCents: z.number().int(), profitByChannel: z.array(z.object({ channelId: id, name: z.string(), commissionPct: z.number(), suggestedCents: z.number().int(), profitCents: z.number().int() })),
  stock: z.object({ physical: z.number(), reserved: z.number(), free: z.number() }),
});

// Families (docs/12 §5): a page counts families; each family is its original plus its live variants.
export const productFamilyFilter = z.enum(['all', 'technical', 'with_variants']);
export const productVariantItem = z.object({
  id, name: z.string(), label: z.string(), displayName: z.string(), tags: z.array(z.string()), photoUrl: z.string().nullable(),
  costCents: z.number().int(), listCents: z.number().int(), floorCents: z.number().int(), tracksStock: z.boolean(),
  free: z.number(), physical: z.number(), reserved: z.number(), soldCount: z.number(), material: z.string().nullable(), hexes: z.array(z.string()), technical: z.boolean(),
  printerId: id.nullable(), printerName: z.string().nullable(), mode: z.enum(['value', 'formula']), hours: z.number(),
});
export const productFamily = productListItem.extend({
  variantCount: z.number().int(), variants: z.array(productVariantItem),
  /** The search text matched only a variant (not the original): the screen opens its panel. */
  matchedByVariant: z.boolean(),
});
export const productFamilyCounts = z.object({ families: z.number().int(), technical: z.number().int(), withVariants: z.number().int() });
export const productFamilyPage = z.object({ items: z.array(productFamily), page: z.number().int(), pageSize: z.number().int(), total: z.number().int(), counts: productFamilyCounts });
/** Flat list for pickers (D-1): every live piece, ordered by family with the original first. */
export const productOptions = z.object({ items: z.array(productListItem) });

export const saveCollectionInput = z.object({
  name, tags: z.array(tag).max(LIMITS.tagsPerProduct).default([]), parts: z.array(z.object({ productId: id, qty: z.number().int().min(1).max(LIMITS.qtyPerItem) })).max(LIMITS.partsPerCollection),
  extrasCents: cents(LIMITS.unitPriceCents).default(0), priceCents: cents(LIMITS.unitPriceCents).nullable().optional(), note: note.default(''),
});
export const collectionListItem = z.object({ id, name: z.string(), tags: z.array(z.string()), listCents: z.number().int(), costCents: z.number().int(), looseCents: z.number().int(), buildableSets: z.number().int(), pieces: z.number().int(), hexes: z.array(z.string()), partNames: z.array(z.string()), typedPrice: z.boolean(), sold: z.number(), partHexes: z.array(z.array(z.string())) });
export const collectionDetail = collectionListItem.extend({
  priceCents: z.number().int().nullable(), extrasCents: z.number().int(), note: z.string(), floorCents: z.number().int(),
  parts: z.array(z.object({ productId: id, name: z.string(), qty: z.number().int(), listCents: z.number().int(), costCents: z.number().int() })),
});

export const fileKind = z.enum(['product_photo', 'customer_logo', 'print_photo']);
export const uploadOutput = z.object({ fileId: id, url: z.string() });

export type SaveProductInput = z.infer<typeof saveProductInput>;
export type ProductListItem = z.infer<typeof productListItem>;
export type SaveProductAsVariantInput = z.infer<typeof saveProductAsVariantInput>;
export type ProductFamilyFilter = z.infer<typeof productFamilyFilter>;
export type ProductVariantItem = z.infer<typeof productVariantItem>;
export type ProductFamily = z.infer<typeof productFamily>;
export type ProductFamilyPage = z.infer<typeof productFamilyPage>;
export type ProductOptions = z.infer<typeof productOptions>;
export type ProductDetail = z.infer<typeof productDetail>;
export type Breakdown = z.infer<typeof breakdown>;
export type SaveCollectionInput = z.infer<typeof saveCollectionInput>;
export type CollectionListItem = z.infer<typeof collectionListItem>;
export type CollectionDetail = z.infer<typeof collectionDetail>;
