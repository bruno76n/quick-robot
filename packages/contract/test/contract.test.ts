import { describe, expect, it } from 'vitest';
import { addSpoolInput, BusinessError, ERROR_DETAILS, ERRORS, httpStatus, toFieldErrors, WARNING_DETAILS, WARNINGS } from '../src';

const valid = { filament: { material: 'PLA', color: 'Negro' }, brand: 'Bambu', costCents: 45000, shippingCents: 5000, grams: 1000, purchasedOn: '2026-11-01' };

describe('addSpool input', () => {
  it('accepts a new filament or an existing one, not both or neither', () => {
    expect(addSpoolInput.safeParse(valid).success).toBe(true);
    expect(addSpoolInput.safeParse({ ...valid, filament: undefined, filamentId: '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b' }).success).toBe(true);
    const neither = addSpoolInput.safeParse({ ...valid, filament: undefined });
    expect(neither.success).toBe(false);
    if (!neither.success) expect(toFieldErrors(neither.error)).toContainEqual({ path: 'filament', rule: 'required' });
  });

  it('maps limits to the rules of docs/13 §6', () => {
    const r = addSpoolInput.safeParse({ ...valid, costCents: 1.5, grams: 100_001, brand: 'x'.repeat(41), purchasedOn: '2026-13-40' });
    expect(r.success).toBe(false);
    if (r.success) return;
    const rules = Object.fromEntries(toFieldErrors(r.error).map((f) => [f.path, f]));
    expect(rules.costCents?.rule).toBe('not_integer');
    expect(rules.grams).toEqual({ path: 'grams', rule: 'too_big', params: { max: 100_000 } });
    expect(rules.brand).toEqual({ path: 'brand', rule: 'too_long', params: { max: 40 } });
    expect(rules.purchasedOn?.rule).toBe('invalid_date');
  });

  it('missing values are "required" and grams keep one decimal', () => {
    const r = addSpoolInput.safeParse({ filament: { material: '', color: 'Negro' }, grams: 10.25, purchasedOn: '2026-11-01' });
    expect(r.success).toBe(false);
    if (r.success) return;
    const f = toFieldErrors(r.error);
    expect(f).toContainEqual({ path: 'costCents', rule: 'required' });
    expect(f).toContainEqual({ path: 'filament.material', rule: 'required' });
    expect(f.find((x) => x.path === 'grams')?.rule).toBe('invalid_format');
  });
});

describe('errors', () => {
  it('every code has its HTTP status and details list; warnings too', () => {
    for (const code of Object.keys(ERRORS) as (keyof typeof ERRORS)[]) {
      expect(httpStatus(code)).toBeGreaterThanOrEqual(400);
      expect(ERROR_DETAILS[code]).toBeDefined();
    }
    for (const w of WARNINGS) expect(WARNING_DETAILS[w]).toBeDefined();
  });

  it('BusinessError carries code, status and details', () => {
    const e = new BusinessError('INSUFFICIENT_STOCK', { items: [] });
    expect(e.status).toBe(409);
    expect(e.details).toEqual({ items: [] });
    expect(e).toBeInstanceOf(Error);
  });
});
