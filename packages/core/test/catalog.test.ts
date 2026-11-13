import { describe, expect, it } from 'vitest';
import { canonicalEntry, defaultCatalog, findInCatalog, isTechnicalMaterial, normalizeName, UNKNOWN_COLOR_HEX } from '../src/catalog';
import { filamentKey } from '../src/filament';
import { normalizeParents, variantDisplayName, variantLabelFromName } from '../src/variants';
import { VARIANT_NAME_CASES } from './fixtures/variant-names';

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

describe('variants (mejoras/ronda-2.md §3.1, informe-ronda2-a §4.3)', () => {
  it('display name: "<original> · <label>"; an original keeps its name', () => {
    expect(variantDisplayName('Spider-Man · salto (silk morado)', 'Spider-Man · salto', 'silk morado')).toBe('Spider-Man · salto · silk morado');
    expect(variantDisplayName('  Llavero  ', null, null)).toBe('Llavero');
    expect(variantDisplayName('Llavero', 'Llavero', '  ')).toBe('Llavero');
  });

  it.each(VARIANT_NAME_CASES)('label from a legacy name: $case', ({ name, original, label }) => {
    expect(variantLabelFromName(name, original)).toBe(label);
  });

  it('case 13: the label never changes the name it reads', () => {
    const name = 'Spider-Man · salto (variante)';
    variantLabelFromName(name, 'Spider-Man · salto');
    expect(name).toBe('Spider-Man · salto (variante)');
  });

  it('cases 1–3 and 11: parents go to the highest live ancestor; no live ancestor → original', () => {
    const roots = normalizeParents([
      { id: 'a', parentId: null },
      { id: 'b', parentId: 'a' },
      { id: 'c', parentId: 'b' },
      { id: 'd', parentId: 'c' },
      { id: 'x', parentId: null, deleted: true },
      { id: 'y', parentId: 'x' },
      { id: 'z', parentId: 'y' },
      { id: 'q', parentId: 'x' },
      { id: 'del', parentId: 'a', deleted: true },
      { id: 'under-del', parentId: 'del' },
      { id: 'loop1', parentId: 'loop2' },
      { id: 'loop2', parentId: 'loop1' },
      { id: 'lost', parentId: 'nowhere' },
    ]);
    expect(Object.fromEntries(roots)).toEqual({
      a: null, b: 'a', c: 'a', d: 'a', // chains of 2 and 3 levels → the root
      x: null, y: null, z: 'y', q: null, // root deleted: the live middle link becomes the original; orphans stand alone
      del: 'a', 'under-del': 'a', // a deleted variant keeps its family (in case it is restored)
      loop1: null, loop2: null, lost: null, // corrupt data does not hang nor stay a cycle
    });
  });
});
