import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { tb } from './rich';

describe('tb()', () => {
  it('bolds the filled parameters and keeps plurals', () => {
    const { container } = render(<p>{tb('screens.supplies.summary', { count: 4, value: '$256', low: 1 })}</p>);
    expect(container.textContent).toBe('4 insumos · Valor en inventario: $256 · Por reponer: 1.');
    expect([...container.querySelectorAll('b')].map((b) => b.textContent)).toEqual(['4', '$256', '1']);
  });
  it('falls back to plain text when a parameter is missing', () => {
    const { container } = render(<p>{tb('screens.supplies.summary', {})}</p>);
    expect(container.textContent).not.toContain('{');
  });
});
