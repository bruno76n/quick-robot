// One screen = one route (docs/07). Spanish paths are what the person sees in the address bar.
import { createRootRoute, createRoute, createRouter, redirect, type AnyRoute } from '@tanstack/react-router';
import { NAV } from '../components/AppShell';
import { FilamentList } from '../features/filament/FilamentList';
import { PrintersPage } from '../features/printers/PrintersPage';
import { CollectionEditor } from '../features/products/CollectionEditor';
import { ProductEditor } from '../features/products/ProductEditor';
import { ProductsPage } from '../features/products/ProductsPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { SuppliesPage } from '../features/supplies/SuppliesPage';
import { setNavigator } from '../lib/nav';
import { NotYet } from './NotYet';
import { Root } from './Root';

const UUID = /^[0-9a-f-]{36}$/i;
const idSearch = (key: string) => (s: Record<string, unknown>) => (typeof s[key] === 'string' && UUID.test(s[key] as string) ? { [key]: s[key] as string } : {});

const rootRoute = createRootRoute({ component: Root });
const route = <P extends string>(path: P, component: () => React.ReactNode, validateSearch?: (s: Record<string, unknown>) => Record<string, string>) =>
  createRoute({ getParentRoute: () => rootRoute, path, component, ...(validateSearch ? { validateSearch } : {}) });

const BUILT: Record<string, AnyRoute> = {
  '/filamentos': route('/filamentos', FilamentList, idSearch('f')),
  '/insumos': route('/insumos', SuppliesPage, idSearch('i')),
  '/impresoras': route('/impresoras', PrintersPage),
  '/ajustes': route('/ajustes', SettingsPage),
  '/productos': route('/productos', ProductsPage, (s) => ({ ...(s.tab === 'colecciones' ? { tab: 'colecciones' } : {}), ...(s.vista === 'lista' ? { vista: 'lista' } : {}), ...(['tecnico', 'variante'].includes(String(s.filtro)) ? { filtro: String(s.filtro) } : {}) })),
};
const extra = [
  route('/productos/pieza', ProductEditor, (s) => ({ ...idSearch('id')(s), ...(typeof s.de === 'string' && UUID.test(s.de) ? { de: s.de } : {}) })),
  route('/productos/coleccion', CollectionEditor, idSearch('id')),
];
const index = createRoute({ getParentRoute: () => rootRoute, path: '/', beforeLoad: () => { throw redirect({ href: '/inicio' }); } });
const later = NAV.flatMap(([, items]) => items).filter((i) => !BUILT[i.to]).map((i) => route(i.to, () => <NotYet title={i.label} />));

export const router = createRouter({ routeTree: rootRoute.addChildren([index, ...Object.values(BUILT), ...extra, ...later]), defaultPreload: false });

setNavigator((href, replace) => router.navigate({ href, replace }));
