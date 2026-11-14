// One screen = one route (docs/07). Spanish paths are what the person sees in the address bar.
import { createRootRoute, createRoute, createRouter, parseSearchWith, redirect, stringifySearchWith, type AnyRoute } from '@tanstack/react-router';
import { NAV } from '../components/AppShell';
import { FilamentList } from '../features/filament/FilamentList';
import { PrintersPage } from '../features/printers/PrintersPage';
import { CollectionEditor } from '../features/products/CollectionEditor';
import { ProductEditor } from '../features/products/ProductEditor';
import { ProductsPage } from '../features/products/ProductsPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { SuppliesPage } from '../features/supplies/SuppliesPage';
import { HomePage } from '../features/home/HomePage';
import { SalesPage } from '../features/sales/SalesPage';
import { BuilderPage } from '../features/builder/BuilderPage';
import { OrdersPage } from '../features/orders/OrdersPage';
import { OrderPage } from '../features/orders/OrderPage';
import { ProductionPage } from '../features/production/ProductionPage';
import { StockPage } from '../features/stock/StockPage';
import { PurchasesPage } from '../features/purchases/PurchasesPage';
import { CustomersPage } from '../features/customers/CustomersPage';
import { CustomerPage } from '../features/customers/CustomerPage';
import { ExpensesPage } from '../features/expenses/ExpensesPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { setNavigator } from '../lib/nav';
import { NotYet } from './NotYet';
import { Root } from './Root';

const UUID = /^[0-9a-f-]{36}$/i;
/** `?abono=1`, `?compra=1`: open a dialog of the screen on arrival (ronda-2 §12, D5 and D9). */
const flag = (key: string) => (s: Record<string, unknown>) => (s[key] === 1 || s[key] === '1' ? { [key]: '1' } : {});
const idSearch = (key: string) => (s: Record<string, unknown>) => (typeof s[key] === 'string' && UUID.test(s[key] as string) ? { [key]: s[key] as string } : {});

const rootRoute = createRootRoute({ component: Root });
const route = <P extends string>(path: P, component: () => React.ReactNode, validateSearch?: (s: Record<string, unknown>) => Record<string, string>) =>
  createRoute({ getParentRoute: () => rootRoute, path, component, ...(validateSearch ? { validateSearch } : {}) });

const BUILT: Record<string, AnyRoute> = {
  '/filamentos': route('/filamentos', FilamentList, (s) => ({ ...idSearch('f')(s), ...idSearch('r')(s), ...(['pesar', 'movimientos'].includes(String(s.a)) ? { a: String(s.a) } : {}) })),
  '/insumos': route('/insumos', SuppliesPage, (s) => ({ ...idSearch('i')(s), ...flag('compra')(s) })),
  '/impresoras': route('/impresoras', PrintersPage),
  '/ajustes': route('/ajustes', SettingsPage),
  '/inicio': route('/inicio', HomePage),
  '/ventas': route('/ventas', SalesPage, (s) => ({ ...idSearch('v')(s), ...(typeof s.q === 'string' ? { q: s.q.slice(0, 120) } : {}), ...flag('abono')(s) })),
  '/pedidos': route('/pedidos', OrdersPage, (s) => ({ ...(['tablero', 'lista', 'calendario'].includes(String(s.vista)) ? { vista: String(s.vista) } : {}), ...(typeof s.mes === 'string' && /^\d{4}-\d{2}$/.test(s.mes) ? { mes: s.mes } : {}) })),
  '/produccion': route('/produccion', ProductionPage, (s) => (['stock', 'order', 'test'].includes(String(s.motivo)) ? { motivo: String(s.motivo) } : {})),
  '/existencias': route('/existencias', StockPage, (s) => ({ ...idSearch('p')(s), ...(['fichas', 'lista'].includes(String(s.vista)) ? { vista: String(s.vista) } : {}) })),
  '/compras': route('/compras', PurchasesPage),
  '/clientes': route('/clientes', CustomersPage),
  '/gastos': route('/gastos', ExpensesPage),
  '/reportes': route('/reportes', ReportsPage, (s) => (['7', '30', '90', 'todo'].includes(String(s.periodo)) ? { periodo: String(s.periodo) } : {})),
  '/productos': route('/productos', ProductsPage, (s) => ({ ...(s.tab === 'colecciones' ? { tab: 'colecciones' } : {}), ...(s.vista === 'lista' ? { vista: 'lista' } : {}), ...(['tecnico', 'con-variantes'].includes(String(s.filtro)) ? { filtro: String(s.filtro) } : {}), ...idSearch('abierta')(s) })),
};
const extra = [
  route('/productos/pieza', ProductEditor, (s) => ({ ...idSearch('id')(s), ...idSearch('variante')(s) })),
  route('/productos/coleccion', CollectionEditor, idSearch('id')),
  route('/pedidos/pedido', OrderPage, (s) => ({ ...idSearch('id')(s), ...(['articulos', 'pagos', 'produccion', 'datos'].includes(String(s.tab)) ? { tab: String(s.tab) } : {}) })),
  route('/clientes/cliente', CustomerPage, idSearch('id')),
  route('/armar', BuilderPage, (s) => ({ ...(s.modo === 'pedido' ? { modo: 'pedido' } : { modo: 'venta' }), ...idSearch('id')(s), ...idSearch('cliente')(s), ...idSearch('pieza')(s), ...idSearch('coleccion')(s) })),
];
const index = createRoute({ getParentRoute: () => rootRoute, path: '/', beforeLoad: () => { throw redirect({ href: '/inicio' }); } });
const later = NAV.flatMap(([, items]) => items).filter((i) => !BUILT[i.to]).map((i) => route(i.to, () => <NotYet title={i.label} />));

export const router = createRouter({ routeTree: rootRoute.addChildren([index, ...Object.values(BUILT), ...extra, ...later]), defaultPreload: false,
  // Every search value is a plain string (?periodo=30, ?id=…): no JSON quoting in the address bar.
  parseSearch: parseSearchWith((v) => v), stringifySearch: stringifySearchWith((v) => String(v)) });

setNavigator((href, replace) => router.navigate({ href, replace }));
