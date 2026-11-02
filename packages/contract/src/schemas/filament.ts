// Filaments, spools and spool movements (docs/12 §8 › Filamentos y rollos).
import { z } from 'zod';
import { calendarDate, cents, grams, hex, id, LIMITS, name, note, short } from './common';

export const filamentStatus = z.enum(['no_spools', 'out', 'ending', 'low', 'new', 'ok']);
export const spoolStatus = z.enum(['empty', 'new', 'in_use']);
export const spoolMovementKind = z.enum(['purchase', 'consumption', 'failure', 'waste', 'adjustment']);

export const filamentListItem = z.object({
  id,
  material: z.string(),
  color: z.string(),
  hex: z.string(),
  remainingGrams: z.number(),
  spools: z.number().int(),
  costPerGram: z.number(),
  status: filamentStatus,
  /** Spools with material left (> 0.5 g), their brands and capacity (for the bar), and the value of what is left. */
  activeSpools: z.number().int(),
  brands: z.array(z.string()),
  capacityGrams: z.number(),
  valueCents: z.number().int(),
});

export const spool = z.object({
  id,
  filamentId: id,
  brand: z.string(),
  costCents: z.number().int(),
  shippingCents: z.number().int(),
  grams: z.number(),
  purchasedOn: calendarDate,
  supplierId: id.nullable(),
  remainingGrams: z.number(),
  costPerGram: z.number(),
  status: spoolStatus,
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
  spools: z.array(spool),
  spoolCount: z.number().int(),
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
export type SpoolMovement = z.infer<typeof spoolMovement>;
export type AddSpoolInput = z.infer<typeof addSpoolInput>;
export type AddSpoolOutput = z.infer<typeof addSpoolOutput>;
