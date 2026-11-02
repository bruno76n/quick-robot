// Development seed (docs/10 §1.7): the example business of the mockup, read from its own backup file
// (reference/mockup-backup-v7.json). Example data lives only here and in reference/, never in product code.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const MOCKUP_BACKUP = fileURLToPath(new URL('../../../reference/mockup-backup-v7.json', import.meta.url));

export interface MockupBackup {
  v: number;
  config: { kwh: number; fallos: number; purga: number; margenMin: number; margenFormula: number; canales: { n: string; c: number }[]; negocio: { nombre: string; giro: string; tel: string; email: string; ciudad: string; vigencia: number; pie: string } };
  cat: { materiales: string[]; colores: { n: string; hex: string }[]; marcas: string[] };
  filamentos: { id: string; material: string; color: string; hex: string }[];
  rollos: { id: string; fil: string; marca: string; costo: number; envio: number; gramos: number; fecha: string }[];
  movs: { id: string; rollo: string; fecha: string; tipo: string; g: number; nota: string; ref?: string }[];
  proveedores: { id: string; nombre: string; tel: string; marcas: string; nota: string }[];
  insumos: { id: string; nombre: string; unidad: string; costo: number; minimo: number; nota: string; prov: string }[];
  imovs: { id: string; ins: string; fecha: string; tipo: string; n: number; nota: string; ref?: string }[];
  impresoras: { id: string; nombre: string; costo: number; vidaH: number; mantoH: number; kw: number; horas: number; compra: string; mant: { id: string; tarea: string; cadaH: number; ultH: number; fecha: string }[] }[];
  productos: { id: string; nombre: string; imp: string; horas: number; lote: number; extras: number; insumos: { ins: string; cant: number }[]; filamentos: { fil: string; g: number }[]; precio: number; modo: string; margen?: number | null; tags: string[]; nota: string; padre: string | null; stock: boolean; ficha?: Record<string, string> | null }[];
  colecciones: { id: string; nombre: string; partes: { prod: string; cant: number }[]; extras: number; precio: number; tags: string[]; nota: string }[];
  [k: string]: unknown;
}

export function loadMockupBackup(path = MOCKUP_BACKUP): MockupBackup {
  return JSON.parse(readFileSync(path, 'utf8')) as MockupBackup;
}

/** Internal values (docs/03 › Valores internos): mockup → product. */
export const SPOOL_MOVEMENT_KIND: Record<string, 'purchase' | 'consumption' | 'failure' | 'waste' | 'adjustment'> = {
  compra: 'purchase', consumo: 'consumption', fallo: 'failure', merma: 'waste', ajuste: 'adjustment',
};

export const SUPPLY_MOVEMENT_KIND: Record<string, 'purchase' | 'use' | 'adjustment' | 'waste'> = { compra: 'purchase', uso: 'use', ajuste: 'adjustment', merma: 'waste' };
export const SPEC_KEYS: Record<string, string> = { capa: 'layer', relleno: 'infill', paredes: 'walls', soportes: 'supports', boquilla: 'nozzle', cama: 'bed', archivo: 'file', nota: 'note' };
