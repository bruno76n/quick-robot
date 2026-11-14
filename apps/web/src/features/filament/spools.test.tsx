// Spool screens of ronda 4 (phase C): the helpers that turn API spools into core's previews and the pieces of the dialogs,
// with the numeric cases of docs/04 §1 (1.1a, 1.5a, 1.5b, 1.5c, 1.6).
import type { FilamentListItem, Spool } from '@app/contract';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OrderItem } from '../orders/api';
import { startPlan } from '../orders/StartSpools';
import { shortfallGrams } from '../production/write';
import { CostInfo, costSourceLong, costSourceShort, perGram, previewCost, spoolNumbers, SpoolTag, toSpoolInput } from './spools';
import { partsOf, planOf, spoolPicks, SpoolUse } from './SpoolUse';

afterEach(cleanup);

const spool = (number: number, o: Partial<Spool> = {}): Spool => ({
  id: `s${number}`, number, filamentId: 'gris', brand: 'Bambu Lab', costCents: 0, shippingCents: 0, grams: 1000, purchasedOn: '2026-10-01', supplierId: null,
  noCost: false, remainingGrams: 1000, costPerGram: 0, status: 'new', ...o,
});
const filament = (o: Partial<FilamentListItem> = {}): FilamentListItem => ({
  id: 'gris', material: 'PLA', color: 'Gris', hex: '#8d8f94', remainingGrams: 0, spools: [], spoolCount: 0, costPerGram: 0.25, costSource: 'purchases',
  costSpoolNumbers: [9, 5, 3], referenceCentsPerKg: null, status: 'ok', activeSpools: 0, noCostSpools: 0, brands: [], capacityGrams: 0, valueCents: 0, ...o,
});
// Case 1.1a (ronda-4 §2.2a): PLA Gris #3 $200 (empty), #5 $250 with 640 g, #9 $300 new, #7 no cost with 100 g.
const gris = filament({
  remainingGrams: 1740,
  spools: [
    spool(7, { noCost: true, purchasedOn: '2026-09-15', remainingGrams: 100, status: 'in_use' }),
    spool(5, { brand: 'Sunlu', costCents: 25000, purchasedOn: '2026-10-10', remainingGrams: 640, status: 'in_use' }),
    spool(9, { costCents: 30000, purchasedOn: '2026-11-05' }),
    spool(3, { costCents: 20000, purchasedOn: '2026-09-20', remainingGrams: 0, status: 'empty' }),
  ],
});

describe('spool helpers', () => {
  it('number tag, cost per gram with three decimals and the purchases of the average, oldest first', () => {
    render(<SpoolTag n={7} />);
    expect(document.querySelector('.rnum')?.textContent).toBe('#7');
    expect(perGram(0.25)).toBe('$0.250/g');
    expect(spoolNumbers([9, 5, 3])).toEqual(['#3', '#5', '#9']);
    expect(costSourceShort(gris)).toBe('promedio de #3, #5 y #9');
    expect(costSourceShort(filament({ costSource: 'material' }))).toBe('promedio de PLA');
    expect(costSourceShort(filament({ costSource: 'reference' }))).toBe('precio de referencia');
    expect(costSourceLong(filament({ costSource: 'reference', referenceCentsPerKg: 30000 }))).toBe('Sin compras con costo: precio de referencia de $300 por kilo.');
    expect(costSourceLong(filament({ costSource: 'none' }))).toBe('Sin costo de referencia para PLA Gris.');
  });

  it('previewCost: case 1.1a gives $0.25/g whatever spool is printed; a new purchase (case 1.1b) moves the average', () => {
    const own = gris.spools.map(toSpoolInput);
    expect(previewCost([gris], 'PLA', own, [], 3, null).costPerGram).toBeCloseTo(0.25, 6);
    const twelve = toSpoolInput(spool(12, { costCents: 28000, purchasedOn: '2026-11-20' }));
    const after = previewCost([gris], 'PLA', [...own, twelve], [twelve], 3, null);
    expect(after.costPerGram).toBeCloseTo(0.276667, 5);
    expect(after.spoolNumbers).toEqual([12, 9, 5]);
  });

  it('CostInfo: the «i» says where the cost per gram comes from when tapped', () => {
    render(<CostInfo f={gris} />);
    const b = screen.getByRole('button', { name: 'De dónde sale el costo por gramo' });
    expect(b.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(b);
    expect(screen.getByRole('note').textContent).toBe('Promedio de las últimas compras con costo: #3, #5 y #9. Los rollos sin costo no cuentan.');
  });
});

describe('which spool a print uses (Registrar impresión)', () => {
  it('case 1.5a: purge 5 %, 50 g from #7 (100 g) → 47.5 g; nothing chosen sends no spools (automatic order)', () => {
    expect(spoolPicks(gris, undefined)).toBeUndefined();
    const plan = planOf(gris, 50, 5, undefined);
    expect(partsOf(plan).get('s7')).toEqual({ taken: 52.5, consumption: 50, purge: 2.5 });
    expect(spoolPicks(gris, { split: false, first: 's9' })).toEqual([{ spoolId: 's9' }]);
  });

  it('case 1.5b: #7 with 30 g, «#7 lo que tenga + el resto del #5»', () => {
    const f = { ...gris, spools: gris.spools.map((s) => (s.number === 7 ? { ...s, remainingGrams: 30 } : s)) };
    const c = { split: true, first: 's7', second: 's5' };
    expect(spoolPicks(f, c)).toEqual([{ spoolId: 's7' }, { spoolId: 's5' }]);
    const parts = partsOf(planOf(f, 50, 5, c));
    expect(parts.get('s7')).toEqual({ taken: 30, consumption: 28.6, purge: 1.4 });
    expect(parts.get('s5')).toEqual({ taken: 22.5, consumption: 21.4, purge: 1.1 });
  });

  it('SpoolUse: live spools only, the suggested (opened) one marked, before → after; choosing and splitting report the choice', () => {
    const onChange = vi.fn();
    render(<SpoolUse f={gris} grams={50} purgePct={5} choice={undefined} onChange={onChange} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3); // #3 is empty
    expect((radios[0] as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText('Sugerido · abierto')).toBeTruthy();
    expect(document.querySelector('.after-h')?.textContent).toContain('100 g → 47.5 g');
    expect(document.querySelector('.after-h')?.textContent).toContain('se gastan 50 g de la pieza y 2.5 g de purga');
    expect(screen.getByText('PLA Gris: 1,740 g → 1,687.5 g. El costo de la pieza no cambia con el rollo: $0.250/g.')).toBeTruthy();
    fireEvent.click(radios[2]!);
    expect(onChange).toHaveBeenLastCalledWith({ split: false, first: 's9' });
    fireEvent.click(screen.getByRole('button', { name: 'Repartir entre dos rollos' }));
    expect(onChange).toHaveBeenLastCalledWith({ split: true, first: 's7' });
  });

  it('SpoolUse: more than a spool has is SPOOL_INSUFFICIENT in the preview', () => {
    render(<SpoolUse f={gris} grams={50} purgePct={5} choice={{ split: true, first: 's7', firstGrams: '150', second: 's5' }} onChange={() => undefined} />);
    expect(screen.getByRole('alert').textContent).toContain('100 g');
  });
});

describe('«Empezar con el rollo» (Poner en producción)', () => {
  it('case 1.5c: 20 pieces of 45 g, purge 5 % → 945 g; starting with #4 (410 g) it ends and #13 continues → 465 g', () => {
    const negro = filament({ id: 'negro', color: 'Negro', remainingGrams: 1410, spools: [
      spool(4, { filamentId: 'negro', brand: 'eSUN', costCents: 36000, remainingGrams: 410, status: 'in_use' }),
      spool(13, { filamentId: 'negro', brand: 'eSUN', costCents: 36000, purchasedOn: '2026-11-13' }),
    ] });
    const item = { id: 'it1', kind: 'piece', productId: 'srv', collectionId: null, name: 'Servilletero', qty: 20, priceCents: 0, listCents: 0, costCents: 0, extrasCents: 0, totalCents: 0, parts: [], fromStock: {}, toPrint: 20, printerId: null, printerName: null } as OrderItem;
    const data = () => ({ kind: 'piece' as const, productId: 'srv', name: 'Servilletero', qty: 20, price: 0, list: 0, cost: 0 });
    const sp = startPlan([item], data, () => [{ filamentId: 'negro', grams: 45 }], [negro], 5, { 'it1|negro': 's4' });
    expect(sp.needs.get('it1')).toEqual([{ filamentId: 'negro', grams: 900 }]);
    const p = sp.plans.get('negro')!;
    expect(p.last).toBe('it1');
    const parts = partsOf(p.plan);
    expect(parts.get('s4')!.taken).toBe(410);
    expect(parts.get('s13')!.taken).toBe(535);
    expect(sp.startSpools('it1')).toEqual([{ filamentId: 'negro', spoolId: 's4' }]);
    expect(startPlan([item], data, () => [{ filamentId: 'negro', grams: 45 }], [negro], 5, {}).startSpools('it1')).toBeUndefined();
  });
});

describe('«Se descontaron» says what the spools lose (ronda 4 · D)', () => {
  it('the missing grams of FILAMENT_SHORTFALL (with purge) are not deducted, one item or several', () => {
    expect(shortfallGrams([])).toBe(0);
    expect(shortfallGrams([{ code: 'FILAMENT_SHORTFALL', details: { missingGrams: 12.5, name: 'PLA Gris' } }])).toBe(12.5);
    expect(shortfallGrams([{ code: 'FILAMENT_SHORTFALL', details: { items: [{ missingGrams: 10 }, { missingGrams: 2.5 }] } }, { code: 'STOCK_SHORT', details: { missing: 2 } }])).toBe(12.5);
  });
});
