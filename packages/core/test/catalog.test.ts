import { describe, expect, it } from 'vitest';
import { canonicalEntry, defaultCatalog, findInCatalog, isTechnicalMaterial, normalizeName, UNKNOWN_COLOR_HEX } from '../src/catalog';
import { filamentKey } from '../src/filament';

describe('catalog', () => {
  it('normalizes names without case, accents or extra spaces', () => {
    expect(normalizeName('  Café   Oscuro ')).toBe('cafe oscuro');
    expect(filamentKey('PLA', 'café')).toBe(filamentKey('pla', 'Cafe'));
  });

  it('an existing entry keeps its spelling and tone', () => {
    const c = defaultCatalog();
    expect(canonicalEntry('color', c.color, ' negro ')).toEqual({ name: 'Negro', hex: '#26242b', isNew: false });
    expect(canonicalEntry('material', c.material, 'petg')).toEqual({ name: 'PETG', hex: null, isNew: false });
    expect(findInCatalog(c.brand, 'BAMBU lab')?.name).toBe('Bambu Lab');
  });

  it('a new color starts uppercase and takes the chosen tone or the default gray', () => {
    expect(canonicalEntry('color', [], 'verde olivo', '#556b2f')).toEqual({ name: 'Verde olivo', hex: '#556b2f', isNew: true });
    expect(canonicalEntry('color', [], 'lila').hex).toBe(UNKNOWN_COLOR_HEX);
    expect(canonicalEntry('brand', [], '  Prusament ')).toEqual({ name: 'Prusament', hex: null, isNew: true });
    expect(canonicalEntry('brand', [], '   ')).toEqual({ name: '', hex: null, isNew: false });
  });

  it('technical materials', () => {
    expect(isTechnicalMaterial('PETG')).toBe(true);
    expect(isTechnicalMaterial('TPU 95A')).toBe(true);
    expect(isTechnicalMaterial('PLA Silk')).toBe(false);
  });
});
