// Text, button and destination of each attention on Inicio (server kinds: reports.ts › home). The texts are the
// ones of es.ts › screens.home.att; the important part goes in bold.
import type { ReactNode } from 'react';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { centsTotal, date, grams, money, number1 } from '../../lib/format';
import type { Attention } from '../reports/api';
import { allBold, rt } from '../reports/text';

const L = es.screens.home;
const A = 'screens.home.att.';

/** Text, button and destination of each attention (server kinds: reports.ts › home). */
export function attentionView(a: Attention): { text: ReactNode; button: string; href: string } {
  const p = a.params as Record<string, string | number | null>;
  const id = a.target.id ?? '';
  switch (a.kind) {
    case 'order_filament_short':
      return { text: rt(`${A}order_filament_short`, { number: `#${p.number}`, customer: p.customer ?? '', missing: grams(Number(p.missingGrams)), filament: p.filament ?? '', available: grams(Number(p.availableGrams ?? 0)) }, allBold('number', 'customer', 'missing')), button: L.btn.addSpool, href: p.filamentId ? `/filamentos?f=${p.filamentId}` : `/pedidos/pedido?id=${id}` };
    case 'filament_low':
      return { text: rt(`${A}filament_low`, { name: p.name ?? '', grams: grams(Number(p.grams)) }, allBold('name')), button: L.btn.seeFilament, href: `/filamentos?f=${id}` };
    case 'order_due': {
      const d = Number(p.days);
      const when = d < 0 ? t(`${A}dueLate`, { days: -d }) : d === 0 ? L.att.dueToday : d === 1 ? L.att.dueTomorrow : t(`${A}dueIn`, { days: d });
      return { text: rt(`${A}order_due`, { number: `#${p.number}`, customer: p.customer ?? '', when, ready: p.status === 'ready' ? L.att.readySuffix : '' }, allBold('number', 'customer')), button: L.btn.openOrder, href: `/pedidos/pedido?id=${id}` };
    }
    case 'sale_owed':
      return { text: rt(p.customer ? `${A}sale_owed_to` : `${A}sale_owed`, { date: p.on ? date(String(p.on)) : '', customer: p.customer ?? '', owed: centsTotal(Number(p.owedCents)) }, allBold('date', 'customer', 'owed')), button: L.btn.addPayment, href: `/ventas?v=${id}` };
    case 'price_below_floor': {
      const col = a.target.type === 'collection';
      return { text: rt(col ? `${A}price_below_floor_collection` : `${A}price_below_floor_product`, { name: p.name ?? '', price: centsTotal(Number(p.priceCents)), cost: money(Number(p.costCents ?? p.floorCents) / 100) }, allBold('name')), button: col ? L.btn.seeCollection : L.btn.seeProducts, href: col ? `/productos/coleccion?id=${id}` : `/productos/pieza?id=${id}` };
    }
    case 'maintenance': {
      const h = Number(p.remainingHours);
      const status = h <= 0 ? t(`${A}maintenancePast`, { hours: number1(-h) }) : t(`${A}maintenanceLeft`, { hours: number1(h) });
      return { text: rt(`${A}maintenance`, { printer: p.printer ?? '', task: String(p.task ?? '').toLocaleLowerCase('es'), status }, allBold('printer')), button: L.btn.seePrinters, href: '/impresoras' };
    }
    case 'supply_low': {
      const stock = Number(p.stock);
      const state = stock <= 0 ? L.att.supplyOut : t(`${A}supplyLeft`, { qty: number1(stock), unit: p.unit || es.screens.supplies.pza });
      return { text: rt(`${A}supply_low`, { name: p.name ?? '', state }, allBold('name')), button: L.btn.seeSupply, href: `/insumos?i=${id}` };
    }
    case 'backup':
    default:
      return { text: p.days === null || p.days === undefined ? L.att.backupNever : rt(`${A}backupDays`, { days: Number(p.days) }, allBold('days')), button: L.btn.backup, href: '/ajustes' };
  }
}
