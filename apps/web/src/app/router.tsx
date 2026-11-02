import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router';
import { AppShell } from '../components/AppShell';
import { FilamentList } from '../features/filament/FilamentList';
import { Placeholder } from '../features/placeholder/Placeholder';
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

const placeholderRoutes = NAV_ITEMS.filter((i) => !i.built).map((i) =>
  createRoute({ getParentRoute: () => rootRoute, path: i.path, component: () => <Placeholder title={i.label} /> }),
);

const routeTree = rootRoute.addChildren([indexRoute, filamentRoute, ...placeholderRoutes]);

export const router = createRouter({ routeTree, defaultPreload: 'intent' });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
