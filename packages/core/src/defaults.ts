/**
 * Generic starting values for a new business (not Quick Robot data). The business edits them in Ajustes.
 * Same values the mockup starts with.
 */
export const DEFAULT_SETTINGS = {
  kwhPrice: 3,
  failurePct: 5,
  purgePct: 5,
  minMarginPct: 30,
  formulaMarginPct: 50,
} as const;

/** Product tags offered in the calculator (mockup TAGS). */
export const DEFAULT_TAGS: readonly string[] = ['Regalo', 'Coleccionable', 'Personalizado', 'Edición limitada', 'Negocio'];

/** Expense categories (docs/05 › Gastos). */
export const DEFAULT_EXPENSE_CATEGORIES: readonly string[] = ['Renta o espacio', 'Servicios', 'Mantenimiento y refacciones', 'Herramientas', 'Publicidad', 'Envíos', 'Sueldo propio', 'Otros'];
export const MAINTENANCE_EXPENSE_CATEGORY = 'Mantenimiento y refacciones';

/** Materials that are "técnicos" (mockup TECNICOS): a piece is technical if any filament starts with one. */
export const TECHNICAL_MATERIALS: readonly string[] = ['PETG', 'ABS', 'ASA', 'TPU', 'Nylon', 'PC', 'PETG-CF', 'PA-CF'];

export function isTechnicalMaterial(material: string): boolean {
  const m = material.toUpperCase();
  return TECHNICAL_MATERIALS.some((t) => m.startsWith(t.toUpperCase()));
}

/** Print time: hours + minutes → whole minutes (stored), and back. */
export const toMinutes = (hours: number, minutes: number): number => Math.max(0, Math.round((hours || 0) * 60 + (minutes || 0)));
export const minutesToHours = (minutes: number): number => (minutes || 0) / 60;
