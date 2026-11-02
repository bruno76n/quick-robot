import { describe, expect, it } from 'vitest';
import { canonicalName, DEFAULT_COLORS, DEFAULT_MATERIALS, findColorHex } from '../src/catalog';

describe('catalog', () => {
  it('"negro" and "Negro " are the same color; spelling comes from the catalog', () => {
    expect(canonicalName(DEFAULT_COLORS.map((c) => c.name), ' negro ', true)).toEqual({ name: 'Negro', isNew: false });
    expect(canonicalName(DEFAULT_MATERIALS, 'pla silk')).toEqual({ name: 'PLA Silk', isNew: false });
  });
  it('new names: trimmed, colors capitalized', () => {
    expect(canonicalName(DEFAULT_COLORS.map((c) => c.name), 'verde  menta', true)).toEqual({ name: 'Verde menta', isNew: true });
  });
  it('color hex lookup ignores accents', () => {
    expect(findColorHex(DEFAULT_COLORS, 'cafe')).toBe('#7a4a2b');
    expect(findColorHex(DEFAULT_COLORS, 'Turquesa')).toBeUndefined();
  });
});
