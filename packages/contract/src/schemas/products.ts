import { z } from 'zod';
import { Id, MAX_GRAMS, MAX_QTY, Name, NonNegativeMoney } from './common';

export const PriceMode = z.enum(['value', 'formula']);
export const PrintSpec = z.object({
  layer: z.string().max(20).optional(),
  infill: z.string().max(20).optional(),
  walls: z.string().max(20).optional(),
  supports: z.string().max(20).optional(),
  nozzle: z.string().max(20).optional(),
  bed: z.string().max(20).optional(),
  file: z.string().max(300).optional(),
  note: z.string().max(1000).optional(),
});
export type PrintSpec = z.infer<typeof PrintSpec>;

const Tags = z.array(z.string().trim().min(1).max(40)).max(20).default([]);

export const ProductInput = z.object({
  name: Name,
  parentId: Id.nullable().default(null),
  mode: PriceMode,
  priceCents: NonNegativeMoney.default(0),
  marginPct: z.number().min(0).max(95).nullable().default(null),
  printerId: Id.nullable().default(null),
  printMinutes: z.number().int().min(0).max(100_000),
  batchSize: z.number().int().min(1).max(10_000).default(1),
  extrasCents: NonNegativeMoney.default(0),
  tracksStock: z.boolean().default(false),
  tags: Tags,
  note: z.string().max(2000).default(''),
  spec: PrintSpec.nullable().default(null),
  filaments: z.array(z.object({ filamentId: Id, grams: z.number().min(0).max(MAX_GRAMS) })).max(20),
  supplies: z.array(z.object({ supplyId: Id, qty: z.number().min(0).max(MAX_QTY) })).max(20).default([]),
  /** Uploaded photo: undefined keeps the current one (a variant inherits its parent's), null removes it. */
  photoFileId: Id.nullable().optional(),
});
export type ProductInput = z.input<typeof ProductInput>;
export type ProductParsed = z.output<typeof ProductInput>;

export const Costing = z.object({
  M: z.number(),
  L: z.number(),
  Q: z.number(),
  E: z.number(),
  F: z.number(),
  sub: z.number(),
  total: z.number(),
  listPrice: z.number(),
  floor: z.number(),
  suggested: z.number(),
  marginPct: z.number(),
  profit: z.number(),
  technical: z.boolean(),
});
export type Costing = z.infer<typeof Costing>;

export const Product = z.object({
  id: Id,
  name: z.string(),
  parentId: Id.nullable(),
  parentName: z.string().nullable(),
  mode: PriceMode,
  priceCents: z.number().int(),
  marginPct: z.number().nullable(),
  printerId: Id.nullable(),
  printerName: z.string().nullable(),
  printMinutes: z.number().int(),
  batchSize: z.number().int(),
  extrasCents: z.number().int(),
  tracksStock: z.boolean(),
  tags: z.array(z.string()),
  note: z.string(),
  spec: PrintSpec.nullable(),
  photoUrl: z.string().nullable(),
  filaments: z.array(z.object({ filamentId: Id, grams: z.number() })),
  supplies: z.array(z.object({ supplyId: Id, qty: z.number() })),
  costing: Costing,
  collections: z.array(z.object({ id: Id, name: z.string() })),
});
export type Product = z.infer<typeof Product>;

export const CollectionInput = z.object({
  name: Name,
  priceCents: NonNegativeMoney.nullable().default(null),
  extrasCents: NonNegativeMoney.default(0),
  tags: Tags,
  note: z.string().max(2000).default(''),
  parts: z.array(z.object({ productId: Id, qty: z.number().int().min(1).max(1000) })).max(50),
});
export type CollectionInput = z.input<typeof CollectionInput>;

export const Collection = z.object({
  id: Id,
  name: z.string(),
  priceCents: z.number().int().nullable(),
  extrasCents: z.number().int(),
  tags: z.array(z.string()),
  note: z.string(),
  parts: z.array(z.object({ productId: Id, productName: z.string(), qty: z.number().int(), listPrice: z.number(), cost: z.number() })),
  costing: z.object({ loose: z.number(), price: z.number(), pieces: z.number(), extras: z.number(), cost: z.number(), profit: z.number(), pieceCount: z.number(), floor: z.number() }),
});
export type Collection = z.infer<typeof Collection>;

export const Catalogue = z.object({ products: z.array(Product), collections: z.array(Collection) });
export type Catalogue = z.infer<typeof Catalogue>;

/** Everything the calculator needs to preview costs with core in the browser. */
export const CostingContextDto = z.object({
  settings: z.object({ kwhPrice: z.number(), purgePct: z.number(), failurePct: z.number(), minMarginPct: z.number(), formulaMarginPct: z.number() }),
  channels: z.array(z.object({ id: Id, name: z.string(), commissionPct: z.number() })),
  printers: z.array(z.object({ id: Id, name: z.string(), cost: z.number(), lifeHours: z.number(), maintenancePerHour: z.number(), kw: z.number() })),
  filaments: z.array(z.object({ id: Id, material: z.string(), color: z.string(), hex: z.string(), costPerGram: z.number(), remainingGrams: z.number(), activeSpoolCount: z.number().int() })),
  supplies: z.array(z.object({ id: Id, name: z.string(), unit: z.string(), cost: z.number() })),
  businessName: z.string(),
});
export type CostingContextDto = z.infer<typeof CostingContextDto>;

export const SavedId = z.object({ id: Id });
export type SavedId = z.infer<typeof SavedId>;
