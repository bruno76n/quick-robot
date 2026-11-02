// Generic starting values for a new workspace (docs/08 › Cuentas: "valores por defecto genéricos").
// Nothing here belongs to a specific business; every value is a record the person edits in Ajustes.

export const DEFAULT_SETTINGS = {
  kwhPrice: 3,
  failurePct: 5,
  purgePct: 5,
  minMarginPct: 30,
  formulaMarginPct: 50,
  quoteValidDays: 7,
} as const;

export const DEFAULT_CHANNELS: readonly { name: string; commissionPct: number }[] = [{ name: 'Efectivo', commissionPct: 0 }];
export const DEFAULT_CUSTOMER_TYPES = ['Restaurante', 'Empresa', 'Persona', 'Otro'] as const;
export const DEFAULT_EXPENSE_CATEGORIES = ['Renta o espacio', 'Servicios', 'Mantenimiento y refacciones', 'Herramientas', 'Publicidad', 'Envíos', 'Sueldo propio', 'Otros'] as const;
export const MAINTENANCE_EXPENSE_CATEGORY = 'Mantenimiento y refacciones';
export const PRICE_TAGS = ['Regalo', 'Coleccionable', 'Personalizado', 'Edición limitada', 'Negocio'] as const;
