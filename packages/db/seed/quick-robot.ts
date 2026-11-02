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
  [k: string]: unknown;
}

export function loadMockupBackup(path = MOCKUP_BACKUP): MockupBackup {
  return JSON.parse(readFileSync(path, 'utf8')) as MockupBackup;
}

/** Internal values (docs/03 › Valores internos): mockup → product. */
export const SPOOL_MOVEMENT_KIND: Record<string, 'purchase' | 'consumption' | 'failure' | 'waste' | 'adjustment'> = {
  compra: 'purchase', consumo: 'consumption', fallo: 'failure', merma: 'waste', ajuste: 'adjustment',
};
