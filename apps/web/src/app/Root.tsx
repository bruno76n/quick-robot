// Frame of every screen: shell, error limit per route, toasts and the "does not respond" banner (docs/15 §5).
import { useIsFetching, useQuery, useQueryClient } from '@tanstack/react-query';
import { Outlet, useRouterState } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { Banner } from '../components/Banner';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { openPalette } from '../components/CommandPalette';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { CommandLayer } from '../components/Shortcuts';
import { ToastViewport } from '../components/Toast';
import { es } from '../i18n/es';
import { api, ApiError } from '../lib/api';
import { isDesktop } from '../lib/platform';
import { useSettings } from '../lib/queries';
import { isActive, useOrderList } from '../features/orders/api';
import { usePurchases } from '../features/purchases/api';
import { go } from '../lib/nav';

export function Root() {
  const me = useQuery({ queryKey: ['me'], queryFn: async () => (await api.me()).data, staleTime: Infinity });
  const settings = useSettings();
  const business = settings.data?.settings.business;
  // Menu counters (D-6): orders in progress (the board query of Pedidos) and suggested purchases (Compras).
  const board = useOrderList('board');
  const purchases = usePurchases();
  const counts = { '/pedidos': board.data?.items.filter((o) => isActive(o.status)).length ?? 0, '/compras': purchases.data?.count ?? 0 };
  const path = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  const fetching = useIsFetching();
  const down = me.error instanceof ApiError && me.error.code === 'NETWORK_ERROR';
  // A load that takes more than 8 s says so and offers to retry (docs/15 §5 "Carga lenta").
  const [slowFlag, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(fetching > 0), fetching ? 8000 : 0);
    return () => clearTimeout(timer);
  }, [fetching]);
  const slow = slowFlag && fetching > 0;
  useEffect(() => { document.title = business?.name || me.data?.workspace.name || ''; }, [me.data, business?.name]);
  const banner = down ? (
    <Banner action={<button type="button" className="btn sm" onClick={() => void qc.refetchQueries()} disabled={fetching > 0}>{es.common.retry}</button>}>
      {isDesktop() ? es.screens.shell.bannerDown : es.screens.shell.bannerOffline}
    </Banner>
  ) : slow ? (
    <Banner action={<button type="button" className="btn sm" onClick={() => { setSlow(false); void qc.refetchQueries({ fetchStatus: 'fetching' }); }}>{es.screens.fatal.slow.buttons[0]}</button>}>
      {es.screens.fatal.slow.text}
    </Banner>
  ) : null;
  return (
    <>
      <AppShell businessName={business?.name || me.data?.workspace.name || ''} trade={business?.trade ?? ''} banner={banner} counts={counts} onNewPiece={() => void go('/productos/pieza')} onSearch={openPalette}>
        <ErrorBoundary resetKey={path} onHome={() => void go('/inicio')}>
          <LoadingSkeleton />
          <Outlet />
        </ErrorBoundary>
      </AppShell>
      <ToastViewport />
      <CommandLayer />
    </>
  );
}
