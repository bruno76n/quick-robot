// Stock, customers, sales, orders, production, expenses, reports and home (docs/12 §6, §7, §8 › Producción, §9).
import { z } from 'zod';
import { calendarDate, cents, grams, id, LIMITS, name, note, pageQuery, short } from './common';

const qty = z.number().int().min(1).max(LIMITS.qtyPerItem);
const fromStock = z.record(id, z.number().int().min(0).max(LIMITS.qtyPerItem));

// ---------- Stock ----------
export const enableStockInput = z.object({ initialCount: z.number().int().min(0).max(LIMITS.qtyPerItem) });
export const adjustStockInput = z.object({ mode: z.enum(['count', 'delta']), value: z.number().int().min(-LIMITS.qtyPerItem).max(LIMITS.qtyPerItem), note: note.optional() });

// ---------- Customers ----------
export const customerInput = z.object({ name, type: short.min(1), phone: short.optional(), note: note.optional(), logoFileId: id.nullable().optional(), hasLogo: z.boolean().optional() });
export const customerPatch = customerInput.partial();

// ---------- Line items ----------
/** What the interface sends; name, list, cost and parts are the server's photo of the moment (docs/12 §3). */
export const lineItemInput = z.object({
  kind: z.enum(['piece', 'set']), productId: id.optional(), collectionId: id.optional(), qty,
  priceCents: cents(LIMITS.unitPriceCents), fromStock: fromStock.optional(),
}).refine((x) => (x.kind === 'piece' ? !!x.productId : !!x.collectionId), { path: ['productId'], message: 'required' });
const items = z.array(lineItemInput).max(LIMITS.itemsPerDocument);

// ---------- Sales ----------
export const saleQuery = pageQuery.extend({ channelId: id.optional(), customerId: id.optional(), from: calendarDate.optional(), to: calendarDate.optional() });
export const saleInput = z.object({ on: calendarDate, channelId: id, customerId: id.nullable().optional(), note: note.optional(), items, paidNowCents: cents().optional() });
export const salePatch = z.object({ on: calendarDate.optional(), channelId: id.optional(), customerId: id.nullable().optional(), note: note.optional() });
export const paymentInput = z.object({ on: calendarDate, amountCents: cents().refine((n) => n > 0, { message: 'too_small' }), note: note.optional() });
export const returnSaleInput = z.object({ on: calendarDate, restock: z.boolean(), refundCents: cents().optional(), note: note.optional() });

// ---------- Orders ----------
export const ORDER_STATUSES = ['quoted', 'accepted', 'in_production', 'ready', 'delivered', 'cancelled'] as const;
export const orderQuery = pageQuery.extend({
  status: z.union([z.enum(ORDER_STATUSES), z.array(z.enum(ORDER_STATUSES))]).optional(),
  view: z.enum(['board', 'list', 'calendar']).optional(), month: z.string().regex(/^\d{4}-\d{2}$/).optional(), customerId: id.optional(),
});
const orderBase = { customerId: id.nullable().optional(), channelId: id, createdOn: calendarDate, dueOn: calendarDate, note: note.optional(), items, depositCents: cents().optional() };
export const orderInput = z.object({ ...orderBase, accepted: z.boolean() });
export const orderUpdateInput = z.object(orderBase);
export const assignmentsInput = z.object({ assignments: z.array(z.object({ lineItemId: id, printerId: id })).max(LIMITS.itemsPerDocument) });
export const startProductionInput = assignmentsInput.extend({ deductFilament: z.boolean() });
export const deliverInput = z.object({ on: calendarDate, collectCents: cents().optional(), note: note.optional() });
export const cancelInput = z.object({ reason: note, refundCents: cents().optional() });

// ---------- Production ----------
export const printRunQuery = pageQuery.extend({ reason: z.enum(['stock', 'order', 'test']).optional() });
export const printRunInput = z.object({
  on: calendarDate, productId: id.nullable().optional(), text: z.string().trim().max(LIMITS.name).optional(), qty, printerId: id.nullable().optional(),
  result: z.enum(['ok', 'fail']), hours: z.number().min(0).max(LIMITS.hours), reason: z.enum(['stock', 'order', 'test']),
  filaments: z.array(z.object({
    filamentId: id, grams: grams(LIMITS.movementGrams),
    /** Chosen spools (ronda-4 §2.5): grams with purge from each; without grams, all it has up to what is still needed. */
    spools: z.array(z.object({ spoolId: id, grams: grams(LIMITS.movementGrams).refine((g) => g > 0, { message: 'too_small' }).optional() })).max(LIMITS.spoolsPerFilament).optional(),
  })).max(LIMITS.filamentsPerProduct), photoFileId: id.nullable().optional(),
}).refine((x) => x.reason === 'test' || !!x.productId, { path: ['productId'], message: 'required' });

// ---------- Expenses and reports ----------
export const expenseQuery = pageQuery.extend({ from: calendarDate.optional(), to: calendarDate.optional(), category: short.optional() });
export const expenseInput = z.object({ on: calendarDate, concept: name, category: short.min(1), amountCents: cents(), recurring: z.boolean(), endsOn: calendarDate.nullable().optional() })
  .refine((x) => !x.endsOn || x.endsOn >= x.on, { path: ['endsOn'], message: 'invalid_date' });
export const reportQuery = z.object({ period: z.enum(['7', '30', '90', 'all']).optional(), from: calendarDate.optional(), to: calendarDate.optional() });
export const searchQuery = z.object({ q: z.string().trim().min(2).max(LIMITS.name) });

export type EnableStockInput = z.infer<typeof enableStockInput>;
export type AdjustStockInput = z.infer<typeof adjustStockInput>;
export type CustomerInput = z.infer<typeof customerInput>;
export type CustomerPatch = z.infer<typeof customerPatch>;
export type LineItemInput = z.infer<typeof lineItemInput>;
export type SaleInput = z.infer<typeof saleInput>;
export type SalePatch = z.infer<typeof salePatch>;
export type PaymentInput = z.infer<typeof paymentInput>;
export type ReturnSaleInput = z.infer<typeof returnSaleInput>;
export type OrderInput = z.infer<typeof orderInput>;
export type OrderUpdateInput = z.infer<typeof orderUpdateInput>;
export type AssignmentsInput = z.infer<typeof assignmentsInput>;
export type StartProductionInput = z.infer<typeof startProductionInput>;
export type DeliverInput = z.infer<typeof deliverInput>;
export type CancelInput = z.infer<typeof cancelInput>;
export type PrintRunInput = z.infer<typeof printRunInput>;
export type ExpenseInput = z.infer<typeof expenseInput>;
export type OrderStatusValue = (typeof ORDER_STATUSES)[number];
