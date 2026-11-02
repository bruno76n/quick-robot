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
  clientes: { id: string; nombre: string; tipo: string; tel: string; logo: boolean; nota: string; creado: string }[];
  pedidos: { id: string; folio: number; cliente: string; creado: string; entrega: string; entregado?: string; listo?: string; estado: string; canal: string; nota: string; pagos: MockPayment[]; items: MockItem[]; descontado?: boolean; logueado?: boolean; stk?: Record<string, number>; cancelado?: { fecha: string; motivo: string; reembolso: number } }[];
  ventas: { id: string; fecha: string; canal: string; nota: string; cliente: string; pedido: string | null; items: MockItem[]; pagos?: MockPayment[]; dev?: { fecha: string; repone: boolean; reembolso: number; nota: string } }[];
  pmovs: { id: string; prod: string; fecha: string; tipo: string; n: number; nota: string; ref?: string }[];
  imps: { id: string; fecha: string; prod: string; imp: string; res: string; horas: number; cant: number; motivo: string; texto: string; pedido: string; filamentos: { fil: string; g: number }[] }[];
  gastos: { id: string; fecha: string; concepto: string; cat: string; monto: number; rec: boolean; fin: string }[];
  [k: string]: unknown;
}

export interface MockPayment { id: string; fecha: string; monto: number; nota: string }
export interface MockItem { k: 'p' | 'c'; prod?: string; col?: string; nombre: string; cant: number; precio: number; lista: number; costo: number; extras?: number; partes?: { prod: string; nombre: string; cant: number; lista: number; costo: number }[]; imp?: string; uso?: Record<string, number> }
export const ORDER_STATUS: Record<string, string> = { cotizado: 'quoted', aceptado: 'accepted', produccion: 'in_production', listo: 'ready', entregado: 'delivered', cancelado: 'cancelled' };
export const STOCK_MOVEMENT_KIND: Record<string, string> = { inicial: 'initial', impresion: 'print', pedido: 'order_print', venta: 'sale', devolucion: 'return', entrega: 'delivery', ajuste: 'adjustment' };
export const PRINT_REASON: Record<string, string> = { inventario: 'stock', pedido: 'order', prueba: 'test' };

export function loadMockupBackup(path = MOCKUP_BACKUP): MockupBackup {
  return JSON.parse(readFileSync(path, 'utf8')) as MockupBackup;
}

/** Internal values (docs/03 › Valores internos): mockup → product. */
export const SPOOL_MOVEMENT_KIND: Record<string, 'purchase' | 'consumption' | 'failure' | 'waste' | 'adjustment'> = {
  compra: 'purchase', consumo: 'consumption', fallo: 'failure', merma: 'waste', ajuste: 'adjustment',
};

export const SUPPLY_MOVEMENT_KIND: Record<string, 'purchase' | 'use' | 'adjustment' | 'waste'> = { compra: 'purchase', uso: 'use', ajuste: 'adjustment', merma: 'waste' };
export const SPEC_KEYS: Record<string, string> = { capa: 'layer', relleno: 'infill', paredes: 'walls', soportes: 'supports', boquilla: 'nozzle', cama: 'bed', archivo: 'file', nota: 'note' };
