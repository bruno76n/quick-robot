// Filaments, spools and spool movements (docs/12 §8 › Filamentos y rollos).
import { z } from 'zod';
import { calendarDate, cents, grams, hex, id, LIMITS, name, note, short } from './common';

export const filamentStatus = z.enum(['no_spools', 'out', 'ending', 'low', 'new', 'ok']);
export const spoolStatus = z.enum(['empty', 'new', 'in_use']);
export const spoolMovementKind = z.enum(['purchase', 'consumption', 'failure', 'waste', 'adjustment']);

export const costSource = z.enum(['purchases', 'material', 'reference', 'none']);

export const spool = z.object({
  id,
  /** #1, #2…: per workspace, never reused (ronda-4 §2.4). */
  number: z.number().int(),
  filamentId: id,
  brand: z.string(),
  costCents: z.number().int(),
  shippingCents: z.number().int(),
  grams: z.number(),
  purchasedOn: calendarDate,
  supplierId: id.nullable(),
  /** A gift or included with the printer: counts in grams, not in cost. */
  noCost: z.boolean(),
  remainingGrams: z.number(),
  /** Of this spool (0 if noCost); pieces use the cost per gram of the filament. */
  costPerGram: z.number(),
  status: spoolStatus,
});

export const filamentListItem = z.object({
  id,
  material: z.string(),
  color: z.string(),
  hex: z.string(),
  remainingGrams: z.number(),
  /** Live spools, in the order they are used and then the empty ones (newest first). */
  spools: z.array(spool),
  spoolCount: z.number().int(),
  /** Cost per gram for pieces (docs/04 §1): where it comes from and the numbers of the spools in the average (newest first). */
  costPerGram: z.number(),
  costSource,
  costSpoolNumbers: z.array(z.number().int()),
  referenceCentsPerKg: z.number().int().nullable(),
  status: filamentStatus,
  /** Spools with material left (> 0.5 g), their brands and capacity (for the bar), and the value of what is left. */
  activeSpools: z.number().int(),
  /** No-cost spools with material left. */
  noCostSpools: z.number().int(),
  brands: z.array(z.string()),
  capacityGrams: z.number(),
  valueCents: z.number().int(),
});

export const spoolMovement = z.object({
  id,
  spoolId: id,
  on: calendarDate,
  kind: spoolMovementKind,
  grams: z.number(),
  note: z.string(),
  refId: z.string().nullable(),
});

export const filamentDetail = filamentListItem.extend({
  movements: z.array(spoolMovement),
});

export const newFilament = z.object({ material: name, color: name, hex: hex.optional() });

/** addSpool · POST /spools. Either an existing filament or material + color (created if missing). */
export const addSpoolInput = z.object({
  filamentId: id.optional(),
  filament: newFilament.optional(),
  brand: short.default(''),
  costCents: cents(),
  shippingCents: cents().default(0),
  grams: grams(LIMITS.spoolGrams).refine((g) => g > 0, { message: 'too_small' }),
  purchasedOn: calendarDate,
  supplierId: id.optional(),
  note: note.optional(),
}).refine((v) => Boolean(v.filamentId) !== Boolean(v.filament), { path: ['filament'], message: 'required' });

export const addSpoolOutput = z.object({ spool, filament: filamentListItem });

export type FilamentListItem = z.infer<typeof filamentListItem>;
export type FilamentDetail = z.infer<typeof filamentDetail>;
export type Spool = z.infer<typeof spool>;
export type CostSource = z.infer<typeof costSource>;
export type SpoolMovement = z.infer<typeof spoolMovement>;
export type AddSpoolInput = z.infer<typeof addSpoolInput>;
export type AddSpoolOutput = z.infer<typeof addSpoolOutput>;

/** updateSpool · PATCH /spools/:id: the same fields as addSpool (docs/12 §8). */
export const updateSpoolInput = z.object({
  filamentId: id.optional(),
  filament: newFilament.optional(),
  brand: short.optional(),
  costCents: cents().optional(),
  shippingCents: cents().optional(),
  grams: grams(LIMITS.spoolGrams).refine((g) => g > 0, { message: 'too_small' }).optional(),
  purchasedOn: calendarDate.optional(),
  supplierId: id.nullable().optional(),
});

/** recordSpoolMovement · POST /spools/:id/movements. Grams are signed: negative takes material out. */
export const spoolMovementInput = z.object({
  kind: z.enum(['consumption', 'failure', 'waste', 'adjustment']),
  grams: grams(LIMITS.movementGrams).or(z.number().min(-LIMITS.movementGrams).max(0)).refine((g) => g !== 0, { message: 'required' }),
  on: calendarDate,
  note: note.optional(),
});

export type UpdateSpoolInput = z.infer<typeof updateSpoolInput>;
export type SpoolMovementInput = z.infer<typeof spoolMovementInput>;
