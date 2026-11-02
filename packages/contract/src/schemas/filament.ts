import { z } from 'zod';
import { Grams, HexColor, Id, IsoDate, Name, NonNegativeMoney, PositiveMoney } from './common';

export const SpoolMovementKind = z.enum(['purchase', 'consumption', 'failure', 'waste', 'adjustment']);
export type SpoolMovementKind = z.infer<typeof SpoolMovementKind>;

export const FilamentStatus = z.enum(['no_spools', 'out', 'running_out', 'low', 'new', 'normal']);
export type FilamentStatus = z.infer<typeof FilamentStatus>;
export const SpoolStatus = z.enum(['empty', 'new', 'in_use']);
export type SpoolStatus = z.infer<typeof SpoolStatus>;
export const Tone = z.enum(['bad', 'warn', 'info', 'good', 'plain']);

/** One row of the Filamentos list. Derived numbers are computed by the server with core. */
export const Filament = z.object({
  id: Id,
  material: z.string(),
  color: z.string(),
  hex: HexColor,
  spoolCount: z.number().int().nonnegative(),
  activeSpoolCount: z.number().int().nonnegative(),
  /** Brands of the spools that still have material. */
  brands: z.array(z.string()),
  remainingGrams: z.number(),
  /** Fill of the stock bar, 0..100. */
  fillPct: z.number(),
  /** Pesos per gram, not rounded (a rate, not a stored amount). */
  costPerGram: z.number(),
  valueCents: z.number().int(),
  status: FilamentStatus,
  tone: Tone,
});
export type Filament = z.infer<typeof Filament>;

export const Spool = z.object({
  id: Id,
  filamentId: Id,
  brand: z.string(),
  costCents: z.number().int(),
  shippingCents: z.number().int(),
  grams: z.number(),
  purchasedOn: IsoDate,
  supplierId: Id.nullable(),
  remainingGrams: z.number(),
  costPerGram: z.number(),
  status: SpoolStatus,
  /** True for the spool that will be used first when there are several with material. */
  usedFirst: z.boolean(),
});
export type Spool = z.infer<typeof Spool>;

export const SpoolMovement = z.object({
  id: Id,
  spoolId: Id,
  on: IsoDate,
  kind: SpoolMovementKind,
  grams: z.number(),
  note: z.string(),
  refId: Id.nullable(),
});
export type SpoolMovement = z.infer<typeof SpoolMovement>;

export const FilamentDetail = Filament.extend({
  spools: z.array(Spool),
  movements: z.array(SpoolMovement),
});
export type FilamentDetail = z.infer<typeof FilamentDetail>;

export const FilamentList = z.object({
  items: z.array(Filament),
  totals: z.object({
    filaments: z.number().int(),
    spools: z.number().int(),
    remainingGrams: z.number(),
    valueCents: z.number().int(),
  }),
});
export type FilamentList = z.infer<typeof FilamentList>;

/** POST /filaments/spools — addSpool. Creates the filament (material + color) if it does not exist. */
export const AddSpoolInput = z.object({
  material: Name,
  color: Name,
  /** Optional: used only when the filament is created. */
  hex: HexColor.optional(),
  brand: z.string().trim().max(80).default(''),
  costCents: PositiveMoney,
  shippingCents: NonNegativeMoney.default(0),
  grams: Grams.refine((g) => g > 0, 'Must be positive'),
  purchasedOn: IsoDate,
  supplierId: Id.nullable().optional(),
});
export type AddSpoolInput = z.input<typeof AddSpoolInput>;
export type AddSpoolParsed = z.output<typeof AddSpoolInput>;

export const AddSpoolResult = z.object({
  createdFilament: z.boolean(),
  filament: FilamentDetail,
  spoolId: Id,
});
export type AddSpoolResult = z.infer<typeof AddSpoolResult>;

/** PUT /filaments/spools/:id — updateSpool. Same fields as addSpool; may move the spool to another filament. */
export const UpdateSpoolInput = AddSpoolInput;
export type UpdateSpoolInput = z.input<typeof UpdateSpoolInput>;

/** POST /filaments/spools/:id/movements — recordSpoolMovement. `adjustment` may add or take out. */
export const SpoolMovementInput = z.object({
  kind: z.enum(['consumption', 'failure', 'waste', 'adjustment']),
  /** Signed for adjustment (+ adds, − takes out); positive grams for the others. */
  grams: Grams.refine((g) => g !== 0, 'Must not be zero'),
  note: z.string().trim().max(300).default(''),
  on: IsoDate,
});
export type SpoolMovementInput = z.input<typeof SpoolMovementInput>;

export const SpoolResult = z.object({ filament: FilamentDetail, spoolId: Id });
export type SpoolResult = z.infer<typeof SpoolResult>;
