// One screen = one route (docs/07). Spanish paths are what the person sees in the address bar.
import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router';
import { NAV } from '../components/AppShell';
import { FilamentList } from '../features/filament/FilamentList';
import { NotYet } from './NotYet';
import { Root } from './Root';

const rootRoute = createRootRoute({ component: Root });
const index = createRoute({ getParentRoute: () => rootRoute, path: '/', beforeLoad: () => { throw redirect({ href: '/inicio' }); } });
const filaments = createRoute({
  getParentRoute: () => rootRoute,
  path: '/filamentos',
  validateSearch: (s: Record<string, unknown>): { f?: string } => (typeof s.f === 'string' && /^[0-9a-f-]{36}$/i.test(s.f) ? { f: s.f } : {}),
  component: FilamentList,
});
const BUILT = new Set(['/filamentos']);
const later = NAV.flatMap(([, items]) => items).filter((i) => !BUILT.has(i.to)).map((i) =>
  createRoute({ getParentRoute: () => rootRoute, path: i.to, component: () => <NotYet title={i.label} /> }));

export const router = createRouter({ routeTree: rootRoute.addChildren([index, filaments, ...later]), defaultPreload: false });

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}
