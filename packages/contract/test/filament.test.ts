import { describe, expect, it } from 'vitest';
import { AddSpoolInput, BusinessError, errorHttpStatus } from '../src';

describe('AddSpoolInput', () => {
  it('normalizes names and applies defaults', () => {
    const r = AddSpoolInput.parse({ material: '  PLA ', color: 'Gris   claro', costCents: 35000, grams: 1000, purchasedOn: '2026-11-01' });
    expect(r).toMatchObject({ material: 'PLA', color: 'Gris claro', brand: '', shippingCents: 0 });
  });
  it('rejects non-integer cents, zero grams, bad dates, empty material', () => {
    const base = { material: 'PLA', color: 'Negro', costCents: 35000, grams: 1000, purchasedOn: '2026-11-01' };
    expect(AddSpoolInput.safeParse({ ...base, costCents: 350.5 }).success).toBe(false);
    expect(AddSpoolInput.safeParse({ ...base, grams: 0 }).success).toBe(false);
    expect(AddSpoolInput.safeParse({ ...base, grams: 10.25 }).success).toBe(false);
    expect(AddSpoolInput.safeParse({ ...base, purchasedOn: '01/11/2026' }).success).toBe(false);
    expect(AddSpoolInput.safeParse({ ...base, material: '   ' }).success).toBe(false);
  });
});

describe('errors', () => {
  it('maps codes to HTTP and serializes', () => {
    const e = new BusinessError('FILAMENT_NOT_FOUND', 'filament x');
    expect(errorHttpStatus[e.code]).toBe(404);
    expect(e.toBody()).toEqual({ code: 'FILAMENT_NOT_FOUND', message: 'filament x' });
  });
});
