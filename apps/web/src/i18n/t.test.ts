import { es } from './es';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fill, onTextProblem, t } from './t';

afterEach(() => onTextProblem(() => undefined));

describe('t()', () => {
  it('fills {name}', () => {
    expect(fill('Ya existe “{name}”.', { name: 'Mercado Libre' })).toBe('Ya existe “Mercado Libre”.');
  });

  it('plural: 1 → singular; 0 and 2+ → plural', () => {
    const s = '{count} {count|pieza|piezas}';
    expect(fill(s, { count: 1 })).toBe('1 pieza');
    expect(fill(s, { count: 0 })).toBe('0 piezas');
    expect(fill(s, { count: 3 })).toBe('3 piezas');
  });

  it('choice by value', () => {
    expect(t('errors.ORDER_NOT_ACTIVE', { status: 'delivered' })).toBe('Este pedido ya está entregado y no se puede modificar.');
    expect(t('errors.ORDER_NOT_ACTIVE', { status: 'cancelled' })).toBe('Este pedido ya está cancelado y no se puede modificar.');
  });

  it('formats by suffix: Cents, Grams, Hours, Pct; lists with Intl.ListFormat', () => {
    expect(t('errors.PAYMENT_EXCEEDS_BALANCE', { balanceCents: 125000 })).toBe('El monto no puede ser mayor al saldo ($1,250).');
    expect(t('errors.PAYMENT_EXCEEDS_BALANCE', { balanceCents: 3595 })).toBe('El monto no puede ser mayor al saldo ($35.95).');
    expect(t('errors.SPOOL_INSUFFICIENT', { availableGrams: 535 })).toBe('Ese rollo solo tiene 535 g.');
    expect(t('warnings.ORDER_WAITING_OTHER_PRINTERS', { orderNumber: 12, printerNames: ['Impresora 1', 'Impresora 2'] }))
      .toBe('Trabajo terminado. El pedido #12 aún tiene trabajos en Impresora 1 e Impresora 2.'); // Intl uses "e" before an "i" sound
    expect(fill('{printerNames}', { printerNames: ['A1', 'Bambu'] })).toBe('A1 y Bambu');
    expect(fill('{marginPct}', { marginPct: 14.56 })).toBe('14.6%');
    expect(fill('{printHours}', { printHours: 7.25 })).toBe('7 h 15 min');
  });

  it('a percent parameter already carries its sign: no template writes another % after it (price shortcuts showed "30%%")', () => {
    expect(t('screens.calculator.costPlus', { pct: 30 })).toBe('costo + 30%');
    expect(t('screens.calculator.marginOf', { pct: 50 })).toBe('margen 50%');
    expect(t('screens.calculator.formulaNote', { pct: 50 })).toContain('costo ÷ (1 − 50%)');
    expect(t('screens.printers.recoveredAria', { pct: 40 })).toBe('40% de la inversión recuperada');
    const walk = (o: unknown, path: string): string[] => typeof o === 'string' ? (/\{[A-Za-z0-9_]*(?:pct|Pct)\}\s?%/.test(o) ? [path] : [])
      : o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => walk(v, path ? `${path}.${k}` : k)) : [];
    expect(walk(es, '')).toEqual([]);
  });

  it('a missing parameter never prints {x}: generic text and a report', () => {
    const report = vi.fn();
    onTextProblem(report);
    const out = t('errors.CHANNEL_NAME_EXISTS', {});
    expect(out).not.toContain('{');
    expect(report).toHaveBeenCalledWith('missing text parameter', expect.objectContaining({ key: 'errors.CHANNEL_NAME_EXISTS', param: 'name' }));
    expect(t('nope.missing')).not.toContain('{');
  });
});
