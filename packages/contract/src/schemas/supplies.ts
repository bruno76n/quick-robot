// Supplies and suppliers (docs/12 §8 › Insumos y proveedores).
import { z } from 'zod';
import { calendarDate, cents, id, LIMITS, name, note, short } from './common';

export const supplierInput = z.object({ name, phone: short.default(''), brands: z.string().trim().max(LIMITS.name).default(''), note: note.default('') });
export const supplierView = z.object({ id, name: z.string(), phone: z.string(), brands: z.string(), note: z.string() });

const qty = z.number().min(0).max(LIMITS.qtyPerItem);
export const supplyStatus = z.enum(['out', 'low', 'ok']);
export const supplyMovementKind = z.enum(['purchase', 'use', 'adjustment', 'waste']);

export const createSupplyInput = z.object({
  name, unit: short.default(''), costCents: cents(LIMITS.unitPriceCents), minimum: qty.default(0),
  supplierId: id.nullable().optional(), note: note.default(''), initialStock: qty.optional(),
});
export const updateSupplyInput = createSupplyInput.omit({ initialStock: true });
export const supplyPurchaseInput = z.object({ qty: qty.refine((v) => v > 0, { message: 'too_small' }), on: calendarDate, costCents: cents(LIMITS.unitPriceCents).optional(), note: note.optional() });
export const supplyMovementInput = z.object({
  kind: z.enum(['use', 'adjustment', 'waste']), mode: z.enum(['delta', 'count']),
  value: z.number().min(-LIMITS.qtyPerItem).max(LIMITS.qtyPerItem), on: calendarDate, note: note.optional(),
});

export const supplyListItem = z.object({
  id, name: z.string(), unit: z.string(), costCents: z.number().int(), stock: z.number(), minimum: z.number(), status: supplyStatus,
  note: z.string(), supplier: z.object({ id, name: z.string() }).nullable(),
});
export const supplyMovementView = z.object({ id, on: calendarDate, kind: supplyMovementKind, qty: z.number(), note: z.string(), refId: z.string().nullable() });
export const supplyDetail = supplyListItem.extend({ movements: z.array(supplyMovementView), products: z.array(z.object({ id, name: z.string(), qty: z.number() })) });

export type SupplierInput = z.infer<typeof supplierInput>;
export type SupplierView = z.infer<typeof supplierView>;
export type CreateSupplyInput = z.infer<typeof createSupplyInput>;
export type UpdateSupplyInput = z.infer<typeof updateSupplyInput>;
export type SupplyPurchaseInput = z.infer<typeof supplyPurchaseInput>;
export type SupplyMovementInput = z.infer<typeof supplyMovementInput>;
export type SupplyListItem = z.infer<typeof supplyListItem>;
export type SupplyDetail = z.infer<typeof supplyDetail>;
