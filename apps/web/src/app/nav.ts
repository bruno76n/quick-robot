import type { IconName } from '../components/Icon';
import { es } from '../i18n/es';

export interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  /** Letter for the "g + letter" shortcut (mockup GOTO). */
  key?: string;
  /** Built in this phase; others show a placeholder. */
  built: boolean;
}

const n = es.nav;
/** Same groups and order as the mockup's sidebar (docs/06 §1). */
export const NAV: { group: string | null; items: NavItem[] }[] = [
  { group: null, items: [{ path: '/inicio', label: n.home, icon: 'home', key: 'i', built: false }] },
  {
    group: n.groups.sell,
    items: [
      { path: '/productos', label: n.products, icon: 'box', key: 'p', built: true },
      { path: '/ventas', label: n.sales, icon: 'coin', key: 'v', built: false },
      { path: '/pedidos', label: n.orders, icon: 'list', key: 'd', built: false },
    ],
  },
  {
    group: n.groups.workshop,
    items: [
      { path: '/filamentos', label: n.filaments, icon: 'spool', key: 'f', built: true },
      { path: '/insumos', label: n.supplies, icon: 'nut', key: 'n', built: true },
      { path: '/impresoras', label: n.printers, icon: 'printer', built: true },
      { path: '/produccion', label: n.production, icon: 'layers', built: false },
      { path: '/existencias', label: n.stock, icon: 'store', key: 'e', built: false },
      { path: '/compras', label: n.purchases, icon: 'cart', key: 'o', built: false },
    ],
  },
  {
    group: n.groups.business,
    items: [
      { path: '/clientes', label: n.customers, icon: 'users', key: 'c', built: false },
      { path: '/gastos', label: n.expenses, icon: 'wallet', key: 'g', built: false },
      { path: '/reportes', label: n.reports, icon: 'chart', key: 'r', built: false },
      { path: '/ajustes', label: n.settings, icon: 'gear', key: 'a', built: true },
    ],
  },
];

export const NAV_ITEMS = NAV.flatMap((g) => g.items);
