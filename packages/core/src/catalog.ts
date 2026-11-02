// Pick lists that grow by themselves (docs/06 §15): materials, colors with their tone, brands.
// The starting lists are generic for any 3D printing business; each workspace grows its own.

export const DEFAULT_MATERIALS = ['PLA', 'PLA Silk', 'PLA+', 'PETG', 'ABS', 'ASA', 'TPU 95A', 'Nylon'] as const;
export const DEFAULT_COLORS: readonly (readonly [string, string])[] = [
  ['Negro', '#26242b'], ['Blanco', '#f1f1ee'], ['Gris claro', '#b9b7bf'], ['Gris', '#8b8b96'], ['Rojo', '#d8283f'],
  ['Azul', '#2f6fd0'], ['Verde', '#00ae42'], ['Amarillo', '#f2c230'], ['Naranja', '#ee7b21'], ['Morado', '#7b4bd0'],
  ['Rosa', '#ec7fb4'], ['Café', '#7a4a2b'], ['Transparente', '#dfe6ea'],
];
export const DEFAULT_BRANDS = ['Bambu Lab', 'eSUN', 'Sunlu', 'Polymaker', 'Overture', 'Elegoo', 'Creality', 'Hatchbox'] as const;
/** Materials that make a piece "technical" (Productos › Técnicas). */
export const TECHNICAL_MATERIALS = ['PETG', 'ABS', 'ASA', 'TPU', 'Nylon', 'PC', 'PETG-CF', 'PA-CF'] as const;
/** Tone used when a color is not in the list and none was chosen. */
export const UNKNOWN_COLOR_HEX = '#9a9aa6';

export type CatalogKind = 'material' | 'color' | 'brand';
export interface CatalogEntry { name: string; hex?: string | null }

/** Lowercase, without accents and extra spaces: "Café  " = "cafe". */
export function normalizeName(s: string): string {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function tidyName(s: string): string {
  return String(s ?? '').trim().replace(/\s+/g, ' ');
}

export function findInCatalog(list: readonly CatalogEntry[], value: string): CatalogEntry | undefined {
  const k = normalizeName(value);
  return k ? list.find((x) => normalizeName(x.name) === k) : undefined;
}

/**
 * Official name of what was chosen or typed: an existing entry keeps its spelling; a new color starts with
 * an uppercase letter. Returns whether it is new so the caller adds it to the list.
 */
export function canonicalEntry(kind: CatalogKind, list: readonly CatalogEntry[], value: string, hex?: string): { name: string; hex: string | null; isNew: boolean } {
  const v = tidyName(value);
  if (!v) return { name: '', hex: null, isNew: false };
  const found = findInCatalog(list, v);
  if (found) return { name: found.name, hex: found.hex ?? null, isNew: false };
  if (kind === 'color') return { name: v.charAt(0).toLocaleUpperCase('es') + v.slice(1), hex: hex ?? UNKNOWN_COLOR_HEX, isNew: true };
  return { name: v, hex: null, isNew: true };
}

export function defaultCatalog(): Record<CatalogKind, CatalogEntry[]> {
  return {
    material: DEFAULT_MATERIALS.map((name) => ({ name })),
    color: DEFAULT_COLORS.map(([name, hex]) => ({ name, hex })),
    brand: DEFAULT_BRANDS.map((name) => ({ name })),
  };
}

export function isTechnicalMaterial(material: string): boolean {
  const m = material.toUpperCase();
  return TECHNICAL_MATERIALS.some((t) => m.startsWith(t.toUpperCase()));
}
