// Common types and input limits (docs/12 §1 and §3, docs/15 §4).
import { z } from 'zod';
import type { FieldError } from '../errors';

export const LIMITS = {
  name: 120,
  note: 2000,
  short: 40,
  tagsPerProduct: 12,
  itemsPerDocument: 100,
  qtyPerItem: 100_000,
  partsPerCollection: 50,
  suppliesPerProduct: 30,
  filamentsPerProduct: 12,
  unitPriceCents: 100_000_000,
  amountCents: 1_000_000_000,
  spoolGrams: 100_000,
  spoolTareGrams: 10_000,
  movementGrams: 100_000,
  hours: 1000,
  pctMax: 99,
  paymentsPerDocument: 200,
  maintenanceTasksPerPrinter: 30,
  queueJobsPerPrinter: 200,
  jsonBodyBytes: 1_048_576,
  logoMb: 8,
  photoMb: 12,
  importMbLocal: 100,
  importMbCloud: 50,
  pageSizeDefault: 50,
  pageSizeMax: 200,
} as const;

export const id = z.uuid();
export const calendarDate = z.iso.date();
export const name = z.string().trim().min(1).max(LIMITS.name);
export const optionalName = z.string().trim().max(LIMITS.name);
export const note = z.string().max(LIMITS.note);
export const short = z.string().trim().max(LIMITS.short);
export const cents = (max: number = LIMITS.amountCents) => z.number().int().min(0).max(max);
/** Grams with at most one decimal. */
export const grams = (max: number = LIMITS.spoolGrams) => z.number().min(0).max(max).refine((g) => Math.abs(g * 10 - Math.round(g * 10)) < 1e-6, { message: 'one decimal' });
export const pct = z.number().min(0).max(LIMITS.pctMax);
export const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(LIMITS.pageSizeMax).default(LIMITS.pageSizeDefault),
  q: z.string().max(LIMITS.name).optional(),
});

export const page = <T extends z.ZodType>(item: T) => z.object({ items: z.array(item), page: z.number().int(), pageSize: z.number().int(), total: z.number().int() });

export type Page<T> = { items: T[]; page: number; pageSize: number; total: number };

/** Zod issues → `details.fields[]` with the rule names of docs/13 §6. */
export function toFieldErrors(error: z.ZodError): FieldError[] {
  return error.issues.map((i) => {
    const path = i.path.map((p, n) => (typeof p === 'number' ? `[${p}]` : `${n ? '.' : ''}${String(p)}`)).join('');
    const out: FieldError = { path, rule: 'invalid_format' };
    const raw = i as unknown as { expected?: string; minimum?: number; maximum?: number; origin?: string; format?: string };
    if (i.code === 'invalid_type' && raw.expected === 'int') out.rule = 'not_integer';
    else if (i.code === 'invalid_type' && /received (undefined|null)/.test(i.message)) out.rule = 'required';
    else if (i.code === 'too_small') {
      if (raw.origin === 'string' && raw.minimum === 1) out.rule = 'required';
      else { out.rule = 'too_small'; out.params = { min: Number(raw.minimum) }; }
    } else if (i.code === 'too_big') {
      out.rule = raw.origin === 'string' ? 'too_long' : 'too_big';
      out.params = { max: Number(raw.maximum) };
    } else if (i.code === 'invalid_format' && (raw.format === 'date' || raw.format === 'datetime')) out.rule = 'invalid_date';
    else if (i.code === 'invalid_format' && raw.format === 'email') out.rule = 'invalid_email';
    else if (i.code === 'custom' && i.message && /^[a-z_]+$/.test(i.message)) out.rule = i.message;
    return out;
  });
}
