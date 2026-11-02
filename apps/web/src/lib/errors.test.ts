import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { errorText, fieldErrors, fieldText } from './errors';

describe('error texts', () => {
  it('uses docs/13 by code, never the technical message', () => {
    expect(errorText(new ApiError('LAST_CHANNEL', 409)).text).toBe('Debe quedar al menos un canal de venta.');
    expect(errorText(new ApiError('INTERNAL_ERROR', 500, {}, 'abc-123')).text).toContain('abc-123');
    expect(errorText(new Error('boom')).text).not.toContain('boom');
  });
  it('one line per item of INSUFFICIENT_STOCK and the reason of PRINT_RUN_LOCKED', () => {
    const e = errorText(new ApiError('INSUFFICIENT_STOCK', 409, { items: [{ productId: 'p', name: 'Llavero', requested: 3, free: 1 }] }));
    expect(e.lines).toEqual(['Llavero: se piden 3, hay 1 libres.']);
    expect(errorText(new ApiError('PRINT_RUN_LOCKED', 409, { reason: 'pieces_unavailable', pieces: 1 })).text).toContain('esa pieza libre');
  });
  it('desktop texts for connection problems', () => {
    expect(errorText(new ApiError('NETWORK_ERROR', 0)).text).toContain('No hay conexión');
  });
  it('field messages: specific, then by rule, then required', () => {
    expect(fieldText('spool', { path: 'cost', rule: 'required' })).toBe('Falta el costo del rollo.');
    expect(fieldText('spool', { path: 'grams', rule: 'too_big', params: { max: 100000 } })).toBe('Debe ser como máximo 100000.');
    expect(fieldText('x', { path: 'y', rule: 'weird' })).toBe('Falta este dato.');
    expect(fieldErrors(new ApiError('VALIDATION_ERROR', 422, { fields: [{ path: 'a', rule: 'required' }] }))).toHaveLength(1);
  });
});
