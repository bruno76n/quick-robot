import { z } from 'zod';
import { Id, IsoDate, Name, NonNegativeMoney } from './common';

const Qty = z.number().finite();
const Note = z.string().trim().max(300).default('');

export const Supplier = z.object({ id: Id, name: z.string(), phone: z.string(), brands: z.string(), note: z.string() });
export type Supplier = z.infer<typeof Supplier>;
export const SupplierInput = z.object({ name: Name, phone: z.string().trim().max(120).default(''), brands: z.string().trim().max(300).default(''), note: Note });
export type SupplierInput = z.input<typeof SupplierInput>;

export const SupplyStatus = z.enum(['out', 'low', 'enough']);
export type SupplyStatus = z.infer<typeof SupplyStatus>;
export const SupplyMovementKind = z.enum(['purchase', 'use', 'adjustment', 'waste']);
export type SupplyMovementKind = z.infer<typeof SupplyMovementKind>;

export const Supply = z.object({
  id: Id,
  name: z.string(),
  unit: z.string(),
  costCents: z.number().int(),
  minimum: z.number(),
  note: z.string(),
  supplierId: Id.nullable(),
  supplierName: z.string().nullable(),
  stock: z.number(),
  status: SupplyStatus,
  valueCents: z.number().int(),
  usedBy: z.array(z.object({ productId: Id, productName: z.string(), qty: z.number() })),
});
export type Supply = z.infer<typeof Supply>;

export const SupplyMovement = z.object({ id: Id, on: IsoDate, kind: SupplyMovementKind, qty: z.number(), note: z.string() });
export type SupplyMovement = z.infer<typeof SupplyMovement>;
export const SupplyDetail = Supply.extend({ movements: z.array(SupplyMovement) });
export type SupplyDetail = z.infer<typeof SupplyDetail>;

export const SupplyList = z.object({
  items: z.array(Supply),
  totals: z.object({ count: z.number().int(), valueCents: z.number().int(), toRestock: z.number().int() }),
  suppliers: z.array(Supplier),
});
export type SupplyList = z.infer<typeof SupplyList>;

const SupplyFields = {
  name: Name,
  unit: z.string().trim().max(20).default('').transform((u) => u || 'pza'),
  costCents: NonNegativeMoney,
  minimum: Qty.min(0).default(0),
  note: Note,
  supplierId: Id.nullable().default(null),
};
export const CreateSupplyInput = z.object({
  ...SupplyFields,
  /** "Cantidad que tienes ahora" → initial purchase movement. */
  initialQty: Qty.min(0).default(0),
  initialNote: Note,
  on: IsoDate,
});
export type CreateSupplyInput = z.input<typeof CreateSupplyInput>;
export const UpdateSupplyInput = z.object(SupplyFields);
export type UpdateSupplyInput = z.input<typeof UpdateSupplyInput>;

export const SupplyPurchaseInput = z.object({ qty: Qty.positive(), totalCents: NonNegativeMoney.nullable().default(null), on: IsoDate, note: Note });
export type SupplyPurchaseInput = z.input<typeof SupplyPurchaseInput>;
/** "Usar o ajustar": use/waste take qty out; adjustment = real count. */
export const SupplyMovementInput = z.object({ kind: z.enum(['use', 'waste', 'adjustment']), qty: Qty.min(0), on: IsoDate, note: Note });
export type SupplyMovementInput = z.input<typeof SupplyMovementInput>;
