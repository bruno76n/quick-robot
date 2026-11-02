/**
 * Generic starting catalog for picking a spool's material, color and brand (mockup CAT_MATERIALES,
 * CAT_COLORES, CAT_MARCAS). Industry-wide values, not business data: in phase 2 they become the default
 * rows of `catalog_item` for a new workspace and the business edits them in Ajustes.
 */
import { normalizeName } from './filament';

export const DEFAULT_MATERIALS: readonly string[] = ['PLA', 'PLA Silk', 'PLA+', 'PETG', 'ABS', 'ASA', 'TPU 95A', 'Nylon'];

export const DEFAULT_COLORS: readonly { name: string; hex: string }[] = [
  { name: 'Negro', hex: '#26242b' },
  { name: 'Blanco', hex: '#f1f1ee' },
  { name: 'Gris claro', hex: '#b9b7bf' },
  { name: 'Gris', hex: '#8b8b96' },
  { name: 'Rojo', hex: '#d8283f' },
  { name: 'Azul', hex: '#2f6fd0' },
  { name: 'Verde', hex: '#00ae42' },
  { name: 'Amarillo', hex: '#f2c230' },
  { name: 'Naranja', hex: '#ee7b21' },
  { name: 'Morado', hex: '#7b4bd0' },
  { name: 'Rosa', hex: '#ec7fb4' },
  { name: 'Café', hex: '#7a4a2b' },
  { name: 'Transparente', hex: '#dfe6ea' },
];

export const DEFAULT_BRANDS: readonly string[] = ['Bambu Lab', 'eSUN', 'Sunlu', 'Polymaker', 'Overture', 'Elegoo', 'Creality', 'Hatchbox'];

/** Finds a name in a list ignoring case, accents and extra spaces; returns the list's spelling. */
export function findInCatalog(list: readonly string[], typed: string): string | undefined {
  const k = normalizeName(typed);
  return k ? list.find((x) => normalizeName(x) === k) : undefined;
}

/** Hex of a known color (catalog or a filament already registered), if any. */
export function findColorHex(colors: readonly { name: string; hex: string }[], typed: string): string | undefined {
  const k = normalizeName(typed);
  return colors.find((c) => normalizeName(c.name) === k)?.hex;
}

/** Canonical spelling of a typed name: catalog spelling if it matches; new colors get a capital first letter (mockup `canon`). */
export function canonicalName(list: readonly string[], typed: string, capitalize = false): { name: string; isNew: boolean } {
  const v = typed.trim().replace(/\s+/g, ' ');
  if (!v) return { name: '', isNew: false };
  const found = findInCatalog(list, v);
  if (found) return { name: found, isNew: false };
  return { name: capitalize ? v.charAt(0).toUpperCase() + v.slice(1) : v, isNew: true };
}
