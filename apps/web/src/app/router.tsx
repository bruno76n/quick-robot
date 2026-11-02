import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router';
import { AppShell } from '../components/AppShell';
import { FilamentList } from '../features/filament/FilamentList';
import { Placeholder } from '../features/placeholder/Placeholder';
import { PrintersPage } from '../features/printers/PrintersPage';
import { CollectionEditor } from '../features/products/CollectionEditor';
import { ProductEditor } from '../features/products/ProductEditor';
import { ProductsPage } from '../features/products/ProductsPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { SuppliesPage } from '../features/supplies/SuppliesPage';
import { NAV_ITEMS } from './nav';

const rootRoute = createRootRoute({ component: AppShell });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/filamentos' });
  },
});

/** One screen = one route. `?f=<id>` keeps the open drawer in the URL. */
const filamentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/filamentos',
  validateSearch: (s: Record<string, unknown>): { f?: string } => (typeof s.f === 'string' && s.f ? { f: s.f } : {}),
  component: FilamentList,
});

const productsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/productos',
  validateSearch: (s: Record<string, unknown>): { tab?: 'colecciones' } => (s.tab === 'colecciones' ? { tab: 'colecciones' } : {}),
  component: ProductsPage,
});
/** Calculator: new piece (optionally as a variant of `from`) or an existing one. */
const newPieceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/productos/pieza/nueva',
  validateSearch: (s: Record<string, unknown>): { from?: string } => (typeof s.from === 'string' && s.from ? { from: s.from } : {}),
  component: function NewPiece() {
    const { from } = newPieceRoute.useSearch();
    return <ProductEditor key={from ?? 'new'} {...(from ? { from } : {})} />;
  },
});
const pieceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/productos/pieza/$id',
  component: function Piece() {
    const { id } = pieceRoute.useParams();
    return <ProductEditor key={id} id={id} />;
  },
});
const newCollectionRoute = createRoute({ getParentRoute: () => rootRoute, path: '/productos/coleccion/nueva', component: () => <CollectionEditor /> });
const collectionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/productos/coleccion/$id',
  component: function Col() {
    const { id } = collectionRoute.useParams();
    return <CollectionEditor key={id} id={id} />;
  },
});
const suppliesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/insumos',
  validateSearch: (s: Record<string, unknown>): { s?: string } => (typeof s.s === 'string' && s.s ? { s: s.s } : {}),
  component: SuppliesPage,
});
const printersRoute = createRoute({ getParentRoute: () => rootRoute, path: '/impresoras', component: PrintersPage });
const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/ajustes', component: SettingsPage });

const placeholderRoutes = NAV_ITEMS.filter((i) => !i.built).map((i) =>
  createRoute({ getParentRoute: () => rootRoute, path: i.path, component: () => <Placeholder title={i.label} /> }),
);

const routeTree = rootRoute.addChildren([indexRoute, filamentRoute, productsRoute, newPieceRoute, pieceRoute, newCollectionRoute, collectionRoute, suppliesRoute, printersRoute, settingsRoute, ...placeholderRoutes]);

export const router = createRouter({ routeTree, defaultPreload: 'intent' });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
